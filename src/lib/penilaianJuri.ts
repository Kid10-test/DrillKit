import type {
  ButirSubCaption,
  Drill,
  DrillSet,
  KelompokCaption,
  PenandaJudgeTape,
  PenilaianLomba,
  SkemaCaptionId,
  Song,
} from '../db/types'

/**
 * Mesin Murni #20 — Simulasi Penilaian Juri (Caption Recap Sheet), Pemetaan Waktu
 * Judge Tape ke Set & Birama, serta Analisis Tren Skor Run-Through.
 *
 * 100% murni TypeScript (bebas DOM, Dexie, dan React) agar dapat diuji langsung
 * di Node (`qa/penilaian-juri-logika.mjs`).
 */

export const LABEL_SKEMA_CAPTION: Record<SkemaCaptionId, string> = {
  field_show: 'Field Show Kejuaraan (GPMB / IDCA / DCI — 100 poin)',
  street_parade: 'Street Parade / Kirab Jalan Raya (PDBI — 100 poin)',
  indoor_winds: 'Indoor Winds (WGI / IDCA — 100 poin)',
  indoor_perc: 'Indoor Percussion / Drumline (100 poin)',
  indoor_guard: 'Color Guard Contest (WGI / IDCA — 100 poin)',
  kustom: 'Skema Kustom Unit',
}

export const LABEL_KELOMPOK_CAPTION: Record<KelompokCaption, string> = {
  ge: 'General Effect',
  musik: 'Music',
  visual: 'Visual',
  guard: 'Color Guard',
  lainnya: 'Lainnya',
}

export const WARNA_HEX_KELOMPOK: Record<KelompokCaption, string> = {
  ge: '#f59e0b',
  musik: '#38bdf8',
  visual: '#34d399',
  guard: '#e879f9',
  lainnya: '#94a3b8',
}

/**
 * Buat daftar sub-caption bawaan sesuai standar mata lomba kejuaraan (total maks = 100,00 poin).
 */
export function buatSubCaptionDariSkema(skema: SkemaCaptionId): ButirSubCaption[] {
  const butir = (
    id: string,
    kelompok: KelompokCaption,
    label: string,
    maksKomposisi: number,
    maksEksekusi: number,
    pengaliBobot: number,
  ): ButirSubCaption => ({
    id,
    kelompok,
    label,
    maksKomposisi,
    nilaiKomposisi: bulat2(maksKomposisi * 0.75),
    maksEksekusi,
    nilaiEksekusi: bulat2(maksEksekusi * 0.75),
    pengaliBobot,
  })

  switch (skema) {
    case 'field_show':
      // GE (20 + 20 = 40) + Visual (10 + 10 + 10 = 30) + Music (10 + 10 + 10 = 30) = 100.00
      return [
        butir('ge-1', 'ge', 'General Effect 1 (Music / Overall)', 10, 10, 1),
        butir('ge-2', 'ge', 'General Effect 2 (Visual / Overall)', 10, 10, 1),
        butir('vis-prof', 'visual', 'Visual Proficiency', 10, 10, 0.5),
        butir('vis-anal', 'visual', 'Visual Analysis', 10, 10, 0.5),
        butir('vis-cg', 'guard', 'Color Guard', 10, 10, 0.5),
        butir('mus-brass', 'musik', 'Music Brass & Winds', 10, 10, 0.5),
        butir('mus-anal', 'musik', 'Music Analysis / Ensemble', 10, 10, 0.5),
        butir('mus-perc', 'musik', 'Music Percussion', 10, 10, 0.5),
      ]
    case 'street_parade':
      // Musik (35) + Barisan & Display (30) + Guard & Mayoret (20) + GE Kirab (15) = 100.00
      return [
        butir('prd-mus-tiup', 'musik', 'Musikalitas Tiup / Melodi', 10, 10, 1),
        butir('prd-mus-perk', 'musik', 'Musikalitas Perkusi & Tempo Jalan', 7.5, 7.5, 1),
        butir('prd-vis-baris', 'visual', 'Kerapian Banjar × Saf & Langkah', 10, 10, 1),
        butir('prd-vis-vip', 'visual', 'Display & Penghormatan Panggung VIP', 5, 5, 1),
        butir('prd-cg-dm', 'guard', 'Color Guard, Gitapati & Mayoret', 10, 10, 1),
        butir('prd-ge', 'ge', 'Kesan Umum (General Effect Kirab)', 7.5, 7.5, 1),
      ]
    case 'indoor_winds':
      // Music Analysis (30) + Visual Analysis (30) + Overall Effect (40) = 100.00
      return [
        butir('iw-mus', 'musik', 'Music Analysis (Rep / Achv)', 15, 15, 1),
        butir('iw-vis', 'visual', 'Visual Analysis (Comp / Achv)', 15, 15, 1),
        butir('iw-ge1', 'ge', 'Overall Effect — Repertoire & Communication', 10, 10, 1),
        butir('iw-ge2', 'ge', 'Overall Effect — Showmanship & Coordination', 10, 10, 1),
      ]
    case 'indoor_perc':
      // Music (35) + Visual (25) + Effect & Artistry (40) = 100.00
      return [
        butir('ip-mus', 'musik', 'Music Composition & Performance', 17.5, 17.5, 1),
        butir('ip-vis', 'visual', 'Visual Performance & Staging', 12.5, 12.5, 1),
        butir('ip-ge-m', 'ge', 'Music Effect', 10, 10, 1),
        butir('ip-ge-v', 'ge', 'Visual Effect & Artistry', 10, 10, 1),
      ]
    case 'indoor_guard':
      // Equipment (20) + Movement (20) + Design Analysis (20) + General Effect (40) = 100.00
      return [
        butir('ig-eq', 'guard', 'Equipment (Vocabulary / Excellence)', 10, 10, 1),
        butir('ig-mv', 'visual', 'Movement (Vocabulary / Excellence)', 10, 10, 1),
        butir('ig-da', 'visual', 'Design Analysis', 10, 10, 1),
        butir('ig-ge1', 'ge', 'General Effect 1', 10, 10, 1),
        butir('ig-ge2', 'ge', 'General Effect 2', 10, 10, 1),
      ]
    case 'kustom':
    default:
      return [
        butir('kus-ge', 'ge', 'General Effect', 20, 20, 1),
        butir('kus-mus', 'musik', 'Musikalitas & Ensemble', 15, 15, 1),
        butir('kus-vis', 'visual', 'Visual & Teknik Baris', 15, 15, 1),
      ]
  }
}

export type PredikatBoxKejuaraan = 'Box 1' | 'Box 2' | 'Box 3' | 'Box 4' | 'Box 5'

export interface BarisHasilSubCaption {
  id: string
  kelompok: KelompokCaption
  label: string
  namaJuri?: string
  komposisi: number
  maksKomposisi: number
  eksekusi: number
  maksEksekusi: number
  mentah: number
  maksMentah: number
  pengaliBobot: number
  terbobot: number
  maksTerbobot: number
  persen: number
  catatan?: string
}

export interface RingkasanKelompokCaption {
  kelompok: KelompokCaption
  label: string
  terbobot: number
  maksTerbobot: number
  persen: number
}

export interface HasilRekapPenilaian {
  baris: BarisHasilSubCaption[]
  perKelompok: RingkasanKelompokCaption[]
  subtotal: number
  maksSubtotal: number
  totalPenalti: number
  skorAkhir: number
  persenAkhir: number
  predikatBox: PredikatBoxKejuaraan
  ketPredikatBox: string
  terkuat: BarisHasilSubCaption | null
  terlemah: BarisHasilSubCaption | null
}

function jepitAngka(v: number, min: number, maks: number): number {
  if (!Number.isFinite(v)) return min
  return Math.max(min, Math.min(maks, v))
}

function bulat2(v: number): number {
  return Math.round(v * 100) / 100
}

export function tentukanBoxKejuaraan(persen: number): { box: PredikatBoxKejuaraan; ket: string } {
  if (persen >= 90) return { box: 'Box 5', ket: 'Unggul / Superior (siap finalis puncak)' }
  if (persen >= 80) return { box: 'Box 4', ket: 'Sangat Baik / Konsisten di seluruh frasa' }
  if (persen >= 70) return { box: 'Box 3', ket: 'Baik / Kerangka kuat, perlu pemolesan kebersihan' }
  if (persen >= 60) return { box: 'Box 2', ket: 'Berkembang / Fokus pada keseragaman dasar' }
  return { box: 'Box 1', ket: 'Tahap Awal / Susun ulang kejelasan materi dasar' }
}

/**
 * Hitung rekapitulasi lengkap skor *caption*, *sub-caption*, penalti, dan klasifikasi *Box 1–5*.
 */
export function hitungRekapPenilaian(
  p: Pick<PenilaianLomba, 'captions' | 'penalti'>,
): HasilRekapPenilaian {
  const baris: BarisHasilSubCaption[] = (p.captions ?? []).map((c) => {
    const maksK = Math.max(0.5, Number.isFinite(c.maksKomposisi) ? c.maksKomposisi : 10)
    const maksE = Math.max(0.5, Number.isFinite(c.maksEksekusi) ? c.maksEksekusi : 10)
    const komp = bulat2(jepitAngka(c.nilaiKomposisi, 0, maksK))
    const eks = bulat2(jepitAngka(c.nilaiEksekusi, 0, maksE))
    const bobot = Number.isFinite(c.pengaliBobot) && c.pengaliBobot > 0 ? c.pengaliBobot : 1
    const mentah = bulat2(komp + eks)
    const maksMentah = bulat2(maksK + maksE)
    const terbobot = bulat2(mentah * bobot)
    const maksTerbobot = bulat2(maksMentah * bobot)
    const persen = maksTerbobot > 0 ? bulat2((terbobot / maksTerbobot) * 100) : 0
    return {
      id: c.id,
      kelompok: c.kelompok,
      label: c.label,
      namaJuri: c.namaJuri,
      komposisi: komp,
      maksKomposisi: maksK,
      eksekusi: eks,
      maksEksekusi: maksE,
      mentah,
      maksMentah,
      pengaliBobot: bobot,
      terbobot,
      maksTerbobot,
      persen,
      catatan: c.catatan,
    }
  })

  const urutanKelompok: KelompokCaption[] = ['ge', 'musik', 'visual', 'guard', 'lainnya']
  const perKelompok: RingkasanKelompokCaption[] = []
  for (const klp of urutanKelompok) {
    const anggotaKlp = baris.filter((b) => b.kelompok === klp)
    if (!anggotaKlp.length) continue
    const terbobot = bulat2(anggotaKlp.reduce((s, x) => s + x.terbobot, 0))
    const maksTerbobot = bulat2(anggotaKlp.reduce((s, x) => s + x.maksTerbobot, 0))
    perKelompok.push({
      kelompok: klp,
      label: LABEL_KELOMPOK_CAPTION[klp],
      terbobot,
      maksTerbobot,
      persen: maksTerbobot > 0 ? bulat2((terbobot / maksTerbobot) * 100) : 0,
    })
  }

  const subtotal = bulat2(baris.reduce((s, x) => s + x.terbobot, 0))
  const maksSubtotal = bulat2(baris.reduce((s, x) => s + x.maksTerbobot, 0))
  const totalPenalti = bulat2(
    (p.penalti ?? []).reduce((s, pen) => s + Math.max(0, Number.isFinite(pen.poin) ? pen.poin : 0), 0),
  )
  const skorAkhir = bulat2(Math.max(0, subtotal - totalPenalti))
  const persenAkhir = maksSubtotal > 0 ? bulat2((skorAkhir / maksSubtotal) * 100) : 0
  const { box, ket } = tentukanBoxKejuaraan(persenAkhir)

  let terkuat: BarisHasilSubCaption | null = null
  let terlemah: BarisHasilSubCaption | null = null
  for (const b of baris) {
    if (!terkuat || b.persen > terkuat.persen) terkuat = b
    if (!terlemah || b.persen < terlemah.persen) terlemah = b
  }

  return {
    baris,
    perKelompok,
    subtotal,
    maksSubtotal,
    totalPenalti,
    skorAkhir,
    persenAkhir,
    predikatBox: box,
    ketPredikatBox: ket,
    terkuat,
    terlemah,
  }
}

/* ========================================================================== */
/*  2. Pemetaan Detik Judge Tape <-> Nomor Set Formasi & Nomor Birama Lagu    */
/* ========================================================================== */

export interface KonteksWaktuPenampilan {
  sets?: Pick<DrillSet, 'id' | 'name' | 'order' | 'counts'>[]
  drill?: Pick<Drill, 'tempo' | 'beatsPerCount'> | null
  song?: Pick<Song, 'bpm' | 'beats' | 'tempoMap'> | null
}

export interface HasilPetaDetik {
  detik: number
  setId?: string
  labelSet?: string
  hitunganSet?: number
  birama?: number
  ketukDalamBirama?: number
}

function daftarBiramaDetik(
  song?: Pick<Song, 'bpm' | 'beats' | 'tempoMap'> | null,
  tempoCadangan = 120,
): { nomorBirama: number; mulaiDetik: number; durasiDetik: number; bpm: number; beats: number }[] {
  if (!song) return []
  const segs = song.tempoMap?.length
    ? song.tempoMap
    : [{ id: 'def', label: 'Utama', measure: 128, bpm: song.bpm || tempoCadangan, beats: song.beats || 4 }]

  const hasil: { nomorBirama: number; mulaiDetik: number; durasiDetik: number; bpm: number; beats: number }[] = []
  let waktu = 0
  let noBar = 1
  for (const s of segs) {
    const jmlBar = Math.max(1, Math.round(s.measure || 1))
    const bpm = Math.max(20, s.bpm || song.bpm || tempoCadangan)
    const beats = Math.max(1, s.beats || song.beats || 4)
    const durBar = (beats * 60) / bpm
    for (let i = 0; i < jmlBar; i++) {
      hasil.push({ nomorBirama: noBar++, mulaiDetik: waktu, durasiDetik: durBar, bpm, beats })
      waktu += durBar
    }
  }
  return hasil
}

function bpmPadaDetik(
  detik: number,
  petaBar: ReturnType<typeof daftarBiramaDetik>,
  tempoDefault: number,
): number {
  if (!petaBar.length) return Math.max(20, tempoDefault || 120)
  for (const b of petaBar) {
    if (detik >= b.mulaiDetik && detik < b.mulaiDetik + b.durasiDetik) return b.bpm
  }
  return petaBar[petaBar.length - 1].bpm
}

/**
 * Petakan cap waktu `detik` pada *Judge Tape* ke **Nomor Set & Hitungan** serta **Nomor Birama**!
 */
export function petakanDetikKeSetDanBirama(
  detikMentah: number,
  konteks: KonteksWaktuPenampilan,
): HasilPetaDetik {
  const detik = Math.max(0, bulat2(Number.isFinite(detikMentah) ? detikMentah : 0))
  const tempoDasar = Math.max(20, konteks.drill?.tempo || konteks.song?.bpm || 120)
  const bpc = Math.max(0.25, konteks.drill?.beatsPerCount || 1)
  const petaBar = daftarBiramaDetik(konteks.song, tempoDasar)

  let birama: number | undefined
  let ketukDalamBirama: number | undefined
  if (petaBar.length > 0) {
    const barCocok = petaBar.find((b) => detik + 1e-9 >= b.mulaiDetik && detik + 1e-9 < b.mulaiDetik + b.durasiDetik)
    if (barCocok) {
      birama = barCocok.nomorBirama
      const dlm = Math.max(0, detik - barCocok.mulaiDetik)
      ketukDalamBirama = Math.min(
        barCocok.beats,
        Math.max(1, Math.floor((dlm / barCocok.durasiDetik) * barCocok.beats + 1e-9) + 1),
      )
    } else {
      const terakhir = petaBar[petaBar.length - 1]
      const sisaDetik = Math.max(0, detik - (terakhir.mulaiDetik + terakhir.durasiDetik))
      const ekstraBar = Math.floor(sisaDetik / terakhir.durasiDetik + 1e-9) + 1
      birama = terakhir.nomorBirama + ekstraBar
      ketukDalamBirama = 1
    }
  }

  let setId: string | undefined
  let labelSet: string | undefined
  let hitunganSet: number | undefined

  const setsUrut = [...(konteks.sets ?? [])].sort((a, b) => a.order - b.order)
  if (setsUrut.length > 0) {
    let kursor = 0
    let ketemu = false
    for (let i = 0; i < setsUrut.length; i++) {
      const s = setsUrut[i]
      const cnt = Math.max(0, s.counts || 0)
      if (cnt === 0 || i === setsUrut.length - 1) {
        // Set penutup/tahan bila sudah mencapai akhir
        if (cnt === 0) {
          setId = s.id
          labelSet = s.name
          hitunganSet = 1
          ketemu = true
          break
        }
      }
      const bpmLokal = bpmPadaDetik(kursor, petaBar, tempoDasar)
      const durasiSet = (cnt * bpc * 60) / bpmLokal
      if (detik + 1e-9 >= kursor && detik + 1e-9 < kursor + durasiSet) {
        setId = s.id
        labelSet = s.name
        hitunganSet = Math.min(
          cnt,
          Math.max(1, Math.floor(((detik - kursor) / durasiSet) * cnt + 1e-9) + 1),
        )
        ketemu = true
        break
      }
      kursor += durasiSet
    }
    if (!ketemu) {
      const ujung = setsUrut[setsUrut.length - 1]
      setId = ujung.id
      labelSet = ujung.name
      hitunganSet = Math.max(1, ujung.counts || 1)
    }
  }

  return {
    detik,
    setId,
    labelSet,
    hitunganSet,
    birama,
    ketukDalamBirama,
  }
}

/**
 * Hitung detik mulai sebuah `setId` dari awal penampilan — dipakai tombol "Putar komentar pada Set X".
 */
export function detikMulaiUntukSet(setIdTarget: string, konteks: KonteksWaktuPenampilan): number | null {
  const setsUrut = [...(konteks.sets ?? [])].sort((a, b) => a.order - b.order)
  if (!setsUrut.length) return null
  const tempoDasar = Math.max(20, konteks.drill?.tempo || konteks.song?.bpm || 120)
  const bpc = Math.max(0.25, konteks.drill?.beatsPerCount || 1)
  const petaBar = daftarBiramaDetik(konteks.song, tempoDasar)

  let kursor = 0
  for (const s of setsUrut) {
    if (s.id === setIdTarget) return bulat2(kursor)
    const cnt = Math.max(0, s.counts || 0)
    const bpmLokal = bpmPadaDetik(kursor, petaBar, tempoDasar)
    kursor += (cnt * bpc * 60) / bpmLokal
  }
  return null
}

/** Format detik ke `MM:SS` (mis. `84.4` -> `"01:24"`). */
export function formatWaktuDetik(detik: number): string {
  const aman = Math.max(0, Math.floor(Number.isFinite(detik) ? detik : 0))
  const m = Math.floor(aman / 60)
  const s = aman % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** Urutkan catatan Judge Tape secara kronologis dari detik 0 ke akhir. */
export function urutkanCatatanJudgeTape(catatan: PenandaJudgeTape[]): PenandaJudgeTape[] {
  return [...(catatan ?? [])].sort((a, b) => a.detik - b.detik)
}

/* ========================================================================== */
/*  3. Analisis Grafik Tren Skor Simulasi Tim (Simulasi #1 -> H-1 Lomba)      */
/* ========================================================================== */

export interface TitikTrenSimulasi {
  id: string
  judul: string
  tanggal: string
  skema: SkemaCaptionId
  skorAkhir: number
  persenAkhir: number
  predikatBox: PredikatBoxKejuaraan
  selisihDariSebelumnya: number | null
  persenPerKelompok: Partial<Record<KelompokCaption, number>>
}

export interface HasilTrenSimulasi {
  titik: TitikTrenSimulasi[]
  skorTertinggi: number
  kenaikanTotal: number | null
  rataRataSkor: number
}

export function hitungTrenSkorSimulasi(
  daftar: PenilaianLomba[],
  opsi?: { skema?: SkemaCaptionId | 'semua'; drillId?: string },
): HasilTrenSimulasi {
  const tersaring = (daftar ?? [])
    .filter((p) => {
      if (opsi?.skema && opsi.skema !== 'semua' && p.skema !== opsi.skema) return false
      if (opsi?.drillId && p.drillId !== opsi.drillId) return false
      return true
    })
    .slice()
    .sort((a, b) => {
      if (a.tanggal !== b.tanggal) return a.tanggal.localeCompare(b.tanggal)
      return (a.createdAt || 0) - (b.createdAt || 0)
    })

  const titik: TitikTrenSimulasi[] = []
  let skorTertinggi = 0

  tersaring.forEach((p, idx) => {
    const rekap = hitungRekapPenilaian(p)
    if (rekap.skorAkhir > skorTertinggi) skorTertinggi = rekap.skorAkhir
    const prev = idx > 0 ? titik[idx - 1].skorAkhir : null
    const persenPerKelompok: Partial<Record<KelompokCaption, number>> = {}
    for (const k of rekap.perKelompok) {
      persenPerKelompok[k.kelompok] = k.persen
    }
    titik.push({
      id: p.id,
      judul: p.judul,
      tanggal: p.tanggal,
      skema: p.skema,
      skorAkhir: rekap.skorAkhir,
      persenAkhir: rekap.persenAkhir,
      predikatBox: rekap.predikatBox,
      selisihDariSebelumnya: prev !== null ? bulat2(rekap.skorAkhir - prev) : null,
      persenPerKelompok,
    })
  })

  const kenaikanTotal =
    titik.length >= 2 ? bulat2(titik[titik.length - 1].skorAkhir - titik[0].skorAkhir) : null
  const rataRataSkor =
    titik.length > 0
      ? bulat2(titik.reduce((s, t) => s + t.skorAkhir, 0) / titik.length)
      : 0

  return {
    titik,
    skorTertinggi,
    kenaikanTotal,
    rataRataSkor,
  }
}
