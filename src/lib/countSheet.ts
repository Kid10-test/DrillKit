/**
 * #17 — Logika murni Lembar Hitungan Color Guard (*Count Sheet*) & Buku Saku Visual.
 *
 * Sengaja bebas dari ketergantungan React, DOM, maupun Dexie supaya:
 * 1. Generator blok dari Set formasi & birama lagu (`buatBlokDariDrill`, `buatBlokDariLagu`),
 * 2. Penghitung sorotan hitungan waktu nyata (`hitungSorotCountSheet`) baik dari
 *    pemutaran Set formasi maupun ketukan metronom/rekaman di halaman Musik,
 * 3. Pencetak HTML murni `#hex` (`bangunHtmlCetakCountSheet` untuk A4 Gabungan &
 *    Buku Saku Lipat A5, `0` `oklch()` / `color-mix()`), serta
 * 4. Penjaga keutuhan rujukan saat pecah/hapus set & salin show
 * semuanya dapat diuji cepat dan deterministik di Node lewat `qa/count-sheet-logika.mjs`.
 */
import type {
  AlatGuard,
  ArahHadapGuard,
  BlokCountSheet,
  CountSheet,
  Drill,
  DrillSet,
  Member,
  SectionDef,
  Song,
} from '../db/types'
import { analisisPerpindahan } from './analitik'
import { biramaDefault, dariBeatsLama, normalisasiBirama } from './birama'
import { coordText, panahArah, stepYd } from './field'
import { ringkasKoreografiSet } from './gerak'
import { namaTampil } from './namaAnggota'
import { esc, printShell } from './print'
import { tugasKruPropertiAnggota } from './propertiGerak'
import { petaPenggaris } from './segmenDrill'
import { uid } from './utils'

/* --------------------- Label & Palet Warna Hex Murni --------------------- */

export const DAFTAR_ALAT_GUARD: AlatGuard[] = [
  'flag',
  'rifle',
  'sabre',
  'swing_flag',
  'air_blade',
  'dance',
  'prop',
]

export const LABEL_ALAT_GUARD: Record<AlatGuard, string> = {
  flag: 'Flag (Bendera)',
  rifle: 'Rifle (Senapan)',
  sabre: 'Sabre (Pedang)',
  swing_flag: 'Swing Flag',
  air_blade: 'Air Blade',
  dance: 'Dance / Body',
  prop: 'Prop / Panggung',
}

export const LABEL_PENDEK_ALAT_GUARD: Record<AlatGuard, string> = {
  flag: 'Flag',
  rifle: 'Rifle',
  sabre: 'Sabre',
  swing_flag: 'Swing',
  air_blade: 'Blade',
  dance: 'Dance',
  prop: 'Prop',
}

/**
 * Palet heksadesimal murni (terang untuk kertas cetak & gelap untuk layar UI).
 * Dijamin tanpa `oklch()` maupun `color-mix()`.
 */
export const WARNA_ALAT_GUARD_HEX: Record<
  AlatGuard,
  { latarCetak: string; tepiCetak: string; teksCetak: string; titikGelap: string }
> = {
  flag: {
    latarCetak: '#fce7f3',
    tepiCetak: '#db2777',
    teksCetak: '#9d174d',
    titikGelap: '#f472b6',
  },
  rifle: {
    latarCetak: '#dbeafe',
    tepiCetak: '#2563eb',
    teksCetak: '#1e40af',
    titikGelap: '#60a5fa',
  },
  sabre: {
    latarCetak: '#ede9fe',
    tepiCetak: '#7c3aed',
    teksCetak: '#5b21b6',
    titikGelap: '#a78bfa',
  },
  swing_flag: {
    latarCetak: '#ffedd5',
    tepiCetak: '#ea580c',
    teksCetak: '#9a3412',
    titikGelap: '#fb923c',
  },
  air_blade: {
    latarCetak: '#ccfbf1',
    tepiCetak: '#0d9488',
    teksCetak: '#115e59',
    titikGelap: '#2dd4bf',
  },
  dance: {
    latarCetak: '#fef3c7',
    tepiCetak: '#d97706',
    teksCetak: '#92400e',
    titikGelap: '#fbbf24',
  },
  prop: {
    latarCetak: '#f1f5f9',
    tepiCetak: '#475569',
    teksCetak: '#1e293b',
    titikGelap: '#94a3b8',
  },
}

export const DAFTAR_ARAH_HADAP_GUARD: ArahHadapGuard[] = [
  'depan',
  'belakang',
  'sisi_1',
  'sisi_2',
  'serong_depan_1',
  'serong_depan_2',
  'bebas',
]

export const LABEL_ARAH_HADAP_GUARD: Record<ArahHadapGuard, string> = {
  depan: 'Hadap Penonton (Depan)',
  belakang: 'Hadap Belakang',
  sisi_1: 'Hadap Sisi 1 (Kiri)',
  sisi_2: 'Hadap Sisi 2 (Kanan)',
  serong_depan_1: 'Serong Depan S1 (45°)',
  serong_depan_2: 'Serong Depan S2 (45°)',
  bebas: 'Bebas / Mengikuti Gerak',
}

/** Kosa kata teknik cepat per jenis alat agar pelatih cukup ketuk pil di lapangan. */
export const TEKNIK_CEPAT_GUARD: Record<AlatGuard, string[]> = {
  flag: [
    'Drop Spin',
    'Peggy Spin',
    'Butterfly',
    'Carve',
    'Thumb Flip',
    'Extension',
    'Toss 45',
    'Toss Parallel',
    'J-Toss',
    'Flourish',
    'Slam / Present',
    'Cradle / Hold',
  ],
  rifle: [
    'Spins',
    'Flourish',
    'Single',
    'Double',
    'Triple',
    'Quad',
    'Five',
    'Backhand',
    'Port / Present',
    'Exchange (Tukar Alat)',
    'Hold / Diam',
  ],
  sabre: [
    'Spins',
    'Blade Toss',
    'Hilt Toss',
    'Single',
    'Double',
    'Triple',
    'Quad',
    'Flourish',
    'En Garde / Present',
    'Exchange (Tukar Alat)',
    'Hold / Diam',
  ],
  swing_flag: [
    'Figure 8',
    'Double Carve',
    'Windmill',
    'Cross Toss',
    'Turn & Release',
    'Open Frame',
    'Hold / Diam',
  ],
  air_blade: [
    'Spin Flow',
    'Single Toss',
    'Double Toss',
    'Triple Toss',
    '45 Release',
    'Pass-Through',
    'Exchange (Tukar Alat)',
  ],
  dance: [
    'Chassé',
    'Jazz Run',
    'Chainé Turn',
    'Lunge / Pose',
    'Leap / Grand Jeté',
    'Floor Roll',
    'Ripple Body',
    'Ganti Alat (Equipment Change)',
  ],
  prop: [
    'Dorong Prop',
    'Putar Prop 90°',
    'Putar Prop 180°',
    'Kunci Roda / Parkir',
    'Ambil Alat dari Prop',
    'Simpan Alat ke Prop',
  ],
}

/* --------------------- Normalisasi & Urutan Blok ------------------------- */

export function urutkanBlokCountSheet(blok: BlokCountSheet[]): BlokCountSheet[] {
  return [...(blok ?? [])]
    .sort((a, b) => a.urutan - b.urutan)
    .map((b, idx) => ({
      ...b,
      urutan: idx,
      counts: Math.max(1, Math.round(b.counts || 8)),
      aksenCount: rapikanDaftarCount(b.aksenCount, b.counts || 8),
      tangkapCount: rapikanDaftarCount(b.tangkapCount, b.counts || 8),
    }))
}

export function rapikanDaftarCount(daftar: number[] | undefined, maksCount: number): number[] | undefined {
  if (!daftar?.length) return undefined
  const batas = Math.max(1, Math.round(maksCount || 8))
  const unik = Array.from(
    new Set(
      daftar
        .map((n) => Math.round(Number(n)))
        .filter((n) => Number.isFinite(n) && n >= 1 && n <= batas),
    ),
  ).sort((a, b) => a - b)
  return unik.length ? unik : undefined
}

/**
 * Tambah/lepas satu nomor hitungan (`1..counts`) pada daftar aksen atau *catch*.
 */
export function toggleNomorCount(
  daftar: number[] | undefined,
  nomor: number,
  maksCount: number,
): number[] | undefined {
  const sekarang = new Set(rapikanDaftarCount(daftar, maksCount) ?? [])
  if (sekarang.has(nomor)) sekarang.delete(nomor)
  else sekarang.add(nomor)
  return rapikanDaftarCount(Array.from(sekarang), maksCount)
}

/**
 * Sisipkan nama teknik ke ringkasan `teknik` blok secara rapi (tanpa koma ganda).
 */
export function sisipkanTeknikCepat(teksLama: string, teknikBaru: string): string {
  const bersih = (teksLama ?? '').trim()
  const tambah = teknikBaru.trim()
  if (!tambah) return bersih
  if (!bersih) return tambah
  const akhiran = bersih.endsWith(',') || bersih.endsWith(';') || bersih.endsWith('·')
  return akhiran ? `${bersih} ${tambah}` : `${bersih}, ${tambah}`
}

/* ---------------- Generator Blok dari Drill & Lagu ----------------------- */

export type ModeGeneratorCountSheet = 'per-8' | 'per-set'

/**
 * Susun daftar `BlokCountSheet` otomatis dari `Drill` + `DrillSet[]` (+ opsional `Song`).
 *
 * - Mode `'per-8'` (bawaan latihan Guard): memecah set panjang menjadi potongan
 *   8-hitungan (`Set 1 (1–8)`, `Set 1 (9–16)`), lengkap `offsetDalamSet` dan
 *   rentang birama presisi dari `petaPenggaris` (`TempoTimeline`).
 * - Mode `'per-set'`: satu blok utuh untuk setiap `DrillSet`.
 * - Bila `blokSebelumnya` diberikan, isian koreografi yang sudah ditulis pada
 *   pasangan `(setId, offsetDalamSet)` akan dipertahankan (sinkronisasi aman).
 */
export function buatBlokDariDrill(opsi: {
  drill: Pick<Drill, 'tempo' | 'beatsPerCount'>
  sets: DrillSet[]
  song?: Song | null
  mode?: ModeGeneratorCountSheet
  alatUtama?: AlatGuard
  blokSebelumnya?: BlokCountSheet[]
}): BlokCountSheet[] {
  const mode = opsi.mode ?? 'per-8'
  const alat = opsi.alatUtama ?? 'flag'
  const urutSets = [...(opsi.sets ?? [])].sort((a, b) => a.order - b.order)
  const bpc = Math.max(0.25, opsi.drill.beatsPerCount || 1)

  const petaLama = new Map<string, BlokCountSheet>()
  for (const bl of opsi.blokSebelumnya ?? []) {
    if (bl.setId) {
      petaLama.set(`${bl.setId}__${bl.offsetDalamSet ?? 0}`, bl)
    }
  }

  const daftarPotongan: { setId: string; offset: number; len: number; label: string }[] = []
  for (let i = 0; i < urutSets.length; i += 1) {
    const st = urutSets[i]
    const totalCounts = Math.max(1, Math.round(st.counts || 8))
    const labelSet = st.name?.trim() || `Set ${i + 1}`
    if (mode === 'per-8' && totalCounts > 8) {
      let off = 0
      while (off < totalCounts) {
        const len = Math.min(8, totalCounts - off)
        daftarPotongan.push({
          setId: st.id,
          offset: off,
          len,
          label: `${labelSet} (${off + 1}–${off + len})`,
        })
        off += len
      }
    } else {
      daftarPotongan.push({
        setId: st.id,
        offset: 0,
        len: totalCounts,
        label: labelSet,
      })
    }
  }

  const laguSegmen = opsi.song
    ? {
        bpm: Math.max(20, opsi.song.bpm || opsi.drill.tempo || 120),
        tandaBirama: opsi.song.tandaBirama ?? dariBeatsLama(opsi.song.beats || 4),
        tempoMap: opsi.song.tempoMap ?? [],
        latih: opsi.song.latih ?? null,
      }
    : {
        bpm: Math.max(20, opsi.drill.tempo || 120),
        tandaBirama: biramaDefault(),
        tempoMap: [],
        latih: null,
      }

  const penggaris =
    daftarPotongan.length > 0
      ? petaPenggaris(
          daftarPotongan.map((p) => ({ counts: p.len, name: p.label })),
          laguSegmen,
          { beatsPerCount: bpc },
        )
      : null

  return daftarPotongan.map((pot, idx) => {
    const blokPeta = penggaris?.set[idx]
    const biramaDari = blokPeta ? Math.max(1, Math.floor(blokPeta.mulaiBirama + 1e-9)) : 1
    const biramaSampai = blokPeta
      ? Math.max(biramaDari, Math.ceil(blokPeta.akhirBirama - 1e-9) - 1)
      : biramaDari

    const lama = petaLama.get(`${pot.setId}__${pot.offset}`)
    return {
      id: lama?.id ?? uid('bcs_'),
      urutan: idx,
      setId: pot.setId,
      offsetDalamSet: pot.offset,
      labelBagian: pot.label,
      counts: pot.len,
      biramaDari,
      biramaSampai,
      alat: lama?.alat ?? alat,
      teknik: lama?.teknik ?? '',
      aksenCount: rapikanDaftarCount(lama?.aksenCount, pot.len),
      tangkapCount: rapikanDaftarCount(lama?.tangkapCount, pot.len),
      detailPerCount: lama?.detailPerCount ? { ...lama.detailPerCount } : undefined,
      arahHadap: lama?.arahHadap ?? 'depan',
      posisiTangan: lama?.posisiTangan,
      catatan: lama?.catatan,
    }
  })
}

/**
 * Generator blok langsung dari `Song` (tanpa Drill), berguna saat tim Color Guard
 * menyusun koreografi alat mengikuti birama musik sebelum formasi digambar.
 */
export function buatBlokDariLagu(
  song: Song,
  alatUtama: AlatGuard = 'flag',
  biramaPerBlok = 2,
): BlokCountSheet[] {
  const langkahBirama = Math.max(1, Math.round(biramaPerBlok || 2))
  const dasar = song.tandaBirama
    ? normalisasiBirama(song.tandaBirama)
    : dariBeatsLama(song.beats || 4)
  const ketukPerBar = Math.max(1, dasar.kelompok.length || dasar.pembilang || 4)
  const maksSegmen = (song.tempoMap ?? []).reduce(
    (maks, tm) => Math.max(maks, (tm.measure || 1) + 7),
    0,
  )
  const totalBirama = Math.max(langkahBirama, song.panjangBirama || maksSegmen || 16)
  const hasil: BlokCountSheet[] = []
  let bar = 1
  let idxFrasa = 1
  while (bar <= totalBirama) {
    const sampai = Math.min(totalBirama, bar + langkahBirama - 1)
    const jmlBar = sampai - bar + 1
    const counts = jmlBar * ketukPerBar
    hasil.push({
      id: uid('bcs_'),
      urutan: hasil.length,
      labelBagian: `Frasa ${idxFrasa} (Bar ${bar}–${sampai})`,
      counts,
      biramaDari: bar,
      biramaSampai: sampai,
      alat: alatUtama,
      teknik: '',
      arahHadap: 'depan',
    })
    bar = sampai + 1
    idxFrasa += 1
  }
  return hasil
}

/* --------------- Pencocokan Seksi & Anggota Color Guard ------------------ */

export function apakahAnggotaGuard(
  anggota: Pick<Member, 'id' | 'section'> | null | undefined,
  sections?: SectionDef[],
  sheets?: CountSheet[],
): boolean {
  if (!anggota) return false
  if ((sheets ?? []).some((cs) => (cs.memberIds ?? []).includes(anggota.id))) return true
  const secId = (anggota.section ?? '').toLowerCase()
  if (secId === 'guard' || secId.includes('guard') || secId.includes('flag') || secId.includes('bendera')) {
    return true
  }
  const def = (sections ?? []).find((s) => s.id === anggota.section)
  const namaSec = (def?.label ?? '').toLowerCase()
  return namaSec.includes('guard') || namaSec.includes('bendera') || namaSec.includes('visual')
}

/**
 * Ambil seluruh `CountSheet` yang berlaku bagi seorang anggota (dan opsional difilter per drill/lagu).
 */
export function countSheetUntukAnggota(
  sheets: CountSheet[],
  anggota: Pick<Member, 'id' | 'section'> | null | undefined,
  filter?: { drillId?: string; songId?: string },
): CountSheet[] {
  const dasar = (sheets ?? []).filter((cs) => {
    if (filter?.drillId && cs.drillId && cs.drillId !== filter.drillId) return false
    if (filter?.drillId && !cs.drillId) return false
    if (filter?.songId && cs.songId && cs.songId !== filter.songId) return false
    if (filter?.songId && !cs.songId) return false
    if (!anggota) return true
    if (cs.memberIds && cs.memberIds.length > 0) {
      return cs.memberIds.includes(anggota.id)
    }
    return cs.seksi === anggota.section
  })
  return dasar.sort((a, b) => a.judul.localeCompare(b.judul))
}

/* ----------- Sorotan Hitungan Sinkron (Formasi & Metronom/Audio) --------- */

export interface HasilSorotCountSheet {
  blokIndex: number
  blok: BlokCountSheet
  /** Nomor hitungan aktif 1-based di dalam `1..blok.counts`. */
  countAktif: number
  /** Apakah hitungan ini ditandai sebagai aksen / *release* (`▲`). */
  adalahAksen: boolean
  /** Apakah hitungan ini ditandai sebagai *catch* / tangkapan (`★`). */
  adalahTangkap: boolean
  /** Rincian spesifik pada hitungan ini bila diisi pelatih. */
  teksDetail?: string
}

/**
 * Hitung blok & nomor hitungan yang sedang aktif pada suatu `CountSheet`.
 *
 * Mendukung dua sumber sinkronisasi waktu nyata:
 * 1. **Dari Pemutaran Formasi (`mode: 'set'`)**: menggunakan `setIdAktif`,
 *    `progresSet` (`0..1`), dan `countsSet` dari animasi perpindahan titik.
 * 2. **Dari Pemutaran Musik/Metronom/Rekaman (`mode: 'musik'`)**: menggunakan
 *    `biramaAktif` (1-based), `ketukDalamBirama` (1-based), dan `ketukPerBirama`
 *    (bawaan 4) untuk menyorot hitungan `1..8` melintasi birama secara presisi!
 */
export function hitungSorotCountSheet(
  sheet: CountSheet | null | undefined,
  sumber:
    | {
        mode: 'set'
        setIdAktif: string
        /** Progres `0..1` selama animasi set berjalan; bila diam = `0` (count ke-1). */
        progresSet: number
        countsSet: number
      }
    | {
        mode: 'musik'
        biramaAktif: number
        /** Ketukan 1-based di dalam birama saat ini (mis. `1..4` pada 4/4). */
        ketukDalamBirama: number
        /** Banyaknya ketukan per birama pada birama aktif (bawaan `4`). */
        ketukPerBirama?: number
        /** Rasio ketuk per hitungan drill (bawaan `1`). */
        beatsPerCount?: number
        /** Bila sedang hitung mundur sebelum birama 1, belum menyorot hitungan. */
        sedangHitungMundur?: boolean
      },
): HasilSorotCountSheet | null {
  if (!sheet || !sheet.blok?.length) return null
  const daftar = urutkanBlokCountSheet(sheet.blok)

  if (sumber.mode === 'set') {
    const totalSet = Math.max(1, Math.round(sumber.countsSet || 8))
    const p = Math.max(0, Math.min(0.999999, Number.isFinite(sumber.progresSet) ? sumber.progresSet : 0))
    const countDalamSet = Math.min(totalSet, Math.floor(p * totalSet) + 1)

    for (let i = 0; i < daftar.length; i += 1) {
      const bl = daftar[i]
      if (bl.setId !== sumber.setIdAktif) continue
      const off = Math.max(0, bl.offsetDalamSet ?? 0)
      if (countDalamSet > off && countDalamSet <= off + bl.counts) {
        const lokal = countDalamSet - off
        return bangunHasilSorot(i, bl, lokal)
      }
    }
    return null
  }

  // Mode 'musik' (metronom / rekaman audio)
  if (sumber.sedangHitungMundur || sumber.biramaAktif < 1) return null
  const kpb = Math.max(1, Math.round(sumber.ketukPerBirama || 4))
  const bpc = Math.max(0.25, sumber.beatsPerCount || 1)
  const ketukBirama = Math.max(1, Math.min(kpb, Math.round(sumber.ketukDalamBirama || 1)))

  // Prioritas 1: cocokkan blok yang punya rentang `biramaDari..biramaSampai`
  const kandidatBirama = daftar
    .map((bl, idx) => ({ bl, idx }))
    .filter(
      ({ bl }) =>
        typeof bl.biramaDari === 'number' &&
        sumber.biramaAktif >= bl.biramaDari &&
        sumber.biramaAktif <= (bl.biramaSampai ?? bl.biramaDari),
    )

  if (kandidatBirama.length > 0) {
    const barAwalGrup = kandidatBirama[0].bl.biramaDari!
    const selisihKetuk = (sumber.biramaAktif - barAwalGrup) * kpb + (ketukBirama - 1)
    const countSejakAwalGrup = Math.floor(selisihKetuk / bpc) + 1
    let akum = 0
    for (const { bl, idx } of kandidatBirama) {
      if (countSejakAwalGrup > akum && countSejakAwalGrup <= akum + bl.counts) {
        return bangunHasilSorot(idx, bl, countSejakAwalGrup - akum)
      }
      akum += bl.counts
    }
    const terakhir = kandidatBirama[kandidatBirama.length - 1]
    return bangunHasilSorot(
      terakhir.idx,
      terakhir.bl,
      Math.max(1, Math.min(terakhir.bl.counts, countSejakAwalGrup - (akum - terakhir.bl.counts))),
    )
  }

  // Prioritas 2: bila blok belum punya `biramaDari`, hitung berurutan sejak birama 1
  const totalKetukSejakAwal = (sumber.biramaAktif - 1) * kpb + (ketukBirama - 1)
  const countGlobal = Math.floor(totalKetukSejakAwal / bpc) + 1
  let akum = 0
  for (let i = 0; i < daftar.length; i += 1) {
    const bl = daftar[i]
    if (countGlobal > akum && countGlobal <= akum + bl.counts) {
      return bangunHasilSorot(i, bl, countGlobal - akum)
    }
    akum += bl.counts
  }
  return null
}

function bangunHasilSorot(
  blokIndex: number,
  blok: BlokCountSheet,
  countAktif: number,
): HasilSorotCountSheet {
  const c = Math.max(1, Math.min(blok.counts, Math.round(countAktif)))
  const adalahAksen = (blok.aksenCount ?? []).includes(c)
  const adalahTangkap = (blok.tangkapCount ?? []).includes(c)
  const teksDetail = blok.detailPerCount?.[c]?.trim() || undefined
  return {
    blokIndex,
    blok,
    countAktif: c,
    adalahAksen,
    adalahTangkap,
    teksDetail,
  }
}

/* ----------- Ringkasan Set untuk DotSheetModal & Kartu Saku -------------- */

/**
 * Ringkas blok kerja alat Guard pada suatu `setId` untuk disisipkan langsung
 * ke baris cetak Dot Sheet / Buku Saku gabungan.
 */
export function ringkasKerjaGuardPadaSet(
  sheets: CountSheet[],
  setId: string,
  anggota?: Pick<Member, 'id' | 'section'> | null,
): string[] {
  const relevan = countSheetUntukAnggota(sheets, anggota)
  const baris: string[] = []
  for (const cs of relevan) {
    const cocok = urutkanBlokCountSheet(cs.blok).filter((b) => b.setId === setId)
    for (const bl of cocok) {
      const alat = LABEL_PENDEK_ALAT_GUARD[bl.alat] ?? bl.alat
      const bagianCount =
        typeof bl.offsetDalamSet === 'number' && (bl.offsetDalamSet > 0 || cocok.length > 1)
          ? ` [${bl.offsetDalamSet + 1}–${bl.offsetDalamSet + bl.counts}]`
          : ''
      const aksen = bl.aksenCount?.length ? ` · ▲${bl.aksenCount.join(',')}` : ''
      const tangkap = bl.tangkapCount?.length ? ` · ★Catch ${bl.tangkapCount.join(',')}` : ''
      const tangan = bl.posisiTangan?.trim() ? ` (${bl.posisiTangan.trim()})` : ''
      const isi = bl.teknik?.trim() || 'Kerja alat'
      baris.push(`${alat}${bagianCount}: ${isi}${aksen}${tangkap}${tangan}`)
    }
  }
  return baris
}

/* ----------- Keutuhan Rujukan (Pecah/Hapus Set & Salin Show) ------------- */

/**
 * Saat sebuah `DrillSet` dihapus (atau dilebur ke set sebelumnya), lepaskan
 * `setId` yatim pada blok `CountSheet` tanpa menghapus catatan koreografinya.
 */
export function bersihkanSetIdCountSheet(sheet: CountSheet, setIdDihapus: string): CountSheet {
  let berubah = false
  const blokBaru = sheet.blok.map((bl) => {
    if (bl.setId !== setIdDihapus) return bl
    berubah = true
    const { setId: _buang, offsetDalamSet: _off, ...sisa } = bl
    return sisa
  })
  return berubah ? { ...sheet, blok: blokBaru, updatedAt: Date.now() } : sheet
}

/**
 * Saat sebuah `DrillSet` (`setLamaId`) dipecah pada hitungan ke-`pecahPada`
 * menjadi `setKiri` (`counts = pecahPada`) dan `setKanan`, sesuaikan tautan
 * `setId` & `offsetDalamSet` pada `CountSheet` agar tetap akurat!
 */
export function sinkronkanCountSheetSaatPecahSet(
  sheet: CountSheet,
  setLamaId: string,
  setKiri: Pick<DrillSet, 'id' | 'name' | 'counts'>,
  setKanan: Pick<DrillSet, 'id' | 'name' | 'counts'>,
): CountSheet {
  const batas = Math.max(1, setKiri.counts)
  let berubah = false
  const hasilBlok: BlokCountSheet[] = []

  for (const bl of urutkanBlokCountSheet(sheet.blok)) {
    if (bl.setId !== setLamaId) {
      hasilBlok.push(bl)
      continue
    }
    berubah = true
    const off = Math.max(0, bl.offsetDalamSet ?? 0)
    const akhir = off + bl.counts
    if (akhir <= batas) {
      // Seluruh blok berada di paruh pertama (setKiri)
      hasilBlok.push({ ...bl, setId: setKiri.id, offsetDalamSet: off })
    } else if (off >= batas) {
      // Seluruh blok berada di paruh kedua (setKanan)
      hasilBlok.push({ ...bl, setId: setKanan.id, offsetDalamSet: off - batas })
    } else {
      // Blok memotong titik pecah -> bagi menjadi dua blok bersih
      const len1 = batas - off
      const len2 = akhir - batas
      hasilBlok.push({
        ...bl,
        setId: setKiri.id,
        offsetDalamSet: off,
        counts: len1,
        labelBagian: `${setKiri.name} (${off + 1}–${batas})`,
        aksenCount: rapikanDaftarCount(bl.aksenCount, len1),
        tangkapCount: rapikanDaftarCount(bl.tangkapCount, len1),
      })
      hasilBlok.push({
        ...bl,
        id: uid('bcs_'),
        setId: setKanan.id,
        offsetDalamSet: 0,
        counts: len2,
        labelBagian: `${setKanan.name} (1–${len2})`,
        aksenCount: rapikanDaftarCount(
          (bl.aksenCount ?? []).filter((n) => n > len1).map((n) => n - len1),
          len2,
        ),
        tangkapCount: rapikanDaftarCount(
          (bl.tangkapCount ?? []).filter((n) => n > len1).map((n) => n - len1),
          len2,
        ),
      })
    }
  }

  return berubah
    ? { ...sheet, blok: urutkanBlokCountSheet(hasilBlok), updatedAt: Date.now() }
    : sheet
}

/**
 * Buat salinan `CountSheet[]` dengan ID baru saat menyalin Drill atau
 * mengimpor `BerkasShow` dalam mode `'salinan'`.
 */
export function salinCountSheetUntukDrillBaru(
  sheets: CountSheet[],
  drillBaruId: string,
  petaIdSet: Record<string, string>,
  petaAnggota?: Record<string, string>,
): CountSheet[] {
  const skrg = Date.now()
  return (sheets ?? []).map((cs) => ({
    ...cs,
    id: uid('cs_'),
    drillId: drillBaruId,
    memberIds: cs.memberIds?.length
      ? Array.from(new Set(cs.memberIds.map((id) => petaAnggota?.[id] ?? id)))
      : undefined,
    blok: urutkanBlokCountSheet(cs.blok).map((bl) => ({
      ...bl,
      id: uid('bcs_'),
      setId: bl.setId ? (petaIdSet[bl.setId] ?? bl.setId) : undefined,
    })),
    createdAt: skrg,
    updatedAt: skrg,
  }))
}

/* --------- Cetak A4 Gabungan & Buku Saku Visual Guard (Hex Murni) -------- */

export type FormatCetakCountSheet = 'a4' | 'buku-saku'

export interface OpsiCetakCountSheet {
  sheet: CountSheet
  format: FormatCetakCountSheet
  namaTim?: string
  drill?: Drill | null
  sets?: DrillSet[]
  song?: Song | null
  /** Bila diisi, lembar dicetak personal untuk daftar anggota ini (lengkap koordinat titik). */
  daftarAnggota?: Member[]
  sections?: SectionDef[]
}

const CSS_CETAK_GUARD_HEX = `
  @page { size: A4 portrait; margin: 10mm; }
  * { box-sizing: border-box; }
  body { background: #ffffff; color: #0f172a; font-family: system-ui, -apple-system, "Segoe UI", sans-serif; }
  .halaman-guard { padding: 4mm 2mm; page-break-after: always; }
  .halaman-guard:last-child { page-break-after: auto; }
  .kepala-guard { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 2px solid #0f172a; padding-bottom: 6px; margin-bottom: 8px; }
  .judul-guard { font-size: 16px; font-weight: 800; color: #0f172a; margin: 0; }
  .sub-guard { font-size: 11px; color: #475569; margin: 2px 0 0; }
  .kotak-pemain { text-align: right; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 4px 8px; }
  .kode-pemain { font-size: 15px; font-weight: 800; color: #0f172a; }
  .nama-pemain { font-size: 10px; color: #334155; }
  .catatan-umum { background: #fffbeb; border: 1px solid #f59e0b; color: #78350f; border-radius: 6px; padding: 5px 8px; font-size: 10.5px; margin-bottom: 8px; }
  table.tabel-cs { width: 100%; border-collapse: collapse; font-size: 10.5px; }
  table.tabel-cs th { background: #f1f5f9; color: #1e293b; border: 1px solid #94a3b8; padding: 5px 6px; text-align: left; font-weight: 700; }
  table.tabel-cs td { border: 1px solid #cbd5e1; padding: 5px 6px; vertical-align: top; color: #0f172a; }
  table.tabel-cs tr:nth-child(even) td { background: #f8fafc; }
  .pil-alat { display: inline-block; padding: 1px 6px; border-radius: 999px; font-size: 9.5px; font-weight: 700; border: 1px solid #64748b; }
  .baris-count { display: flex; flex-wrap: wrap; gap: 3px; margin-top: 4px; }
  .kotak-c { display: inline-flex; align-items: center; justify-content: center; min-width: 17px; height: 17px; padding: 0 3px; border-radius: 3px; border: 1px solid #cbd5e1; background: #ffffff; color: #475569; font-size: 9px; font-weight: 700; }
  .kotak-c.aksen { background: #fef3c7; border-color: #d97706; color: #92400e; }
  .kotak-c.tangkap { background: #d1fae5; border-color: #059669; color: #065f46; }
  .kotak-c.keduanya { background: #fde68a; border-color: #059669; color: #065f46; }
  .meta-kecil { font-size: 9.5px; color: #475569; margin-top: 2px; }
  .detail-c { font-size: 9.5px; color: #334155; margin-top: 3px; }
  .legenda-guard { margin-top: 7px; font-size: 9.5px; color: #475569; display: flex; justify-content: space-between; gap: 8px; }
  /* Buku Saku A5 / Lipat 2 Kartu per Halaman A4 */
  .grid-saku { display: grid; grid-template-columns: 1fr 1fr; gap: 6mm; }
  .kartu-saku-guard { border: 1.5px dashed #64748b; border-radius: 6px; padding: 4mm; background: #ffffff; break-inside: avoid; page-break-inside: avoid; }
  .kepala-saku { display: flex; justify-content: space-between; align-items: baseline; border-bottom: 1.5px solid #0f172a; padding-bottom: 3px; margin-bottom: 5px; }
  .judul-saku { font-size: 11.5px; font-weight: 800; color: #0f172a; }
  .sub-saku { font-size: 9px; color: #475569; }
  .item-saku { border-bottom: 1px solid #e2e8f0; padding: 3.5px 0; font-size: 9.2px; }
  .item-saku:last-child { border-bottom: none; }
  .baris-atas-saku { display: flex; justify-content: space-between; align-items: center; gap: 4px; font-weight: 700; color: #0f172a; }
  .koord-saku { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 8.8px; color: #1e40af; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 3px; padding: 0.5px 4px; }
`

function renderPitaHitunganHtml(bl: BlokCountSheet): string {
  const maks = Math.min(32, Math.max(1, bl.counts))
  const butir: string[] = []
  for (let c = 1; c <= maks; c += 1) {
    const ak = (bl.aksenCount ?? []).includes(c)
    const tk = (bl.tangkapCount ?? []).includes(c)
    const kls = ak && tk ? 'keduanya' : tk ? 'tangkap' : ak ? 'aksen' : ''
    const simbol = tk ? `${c}★` : ak ? `${c}▲` : `${c}`
    butir.push(`<span class="kotak-c ${kls}">${simbol}</span>`)
  }
  const entriDetail = Object.entries(bl.detailPerCount ?? {})
    .map(([k, v]) => ({ c: Number(k), teks: (v ?? '').trim() }))
    .filter((x) => Number.isFinite(x.c) && x.c >= 1 && x.c <= bl.counts && x.teks)
    .sort((a, b) => a.c - b.c)
  const htmlDetail = entriDetail.length
    ? `<div class="detail-c">${entriDetail.map((d) => `<b>[${d.c}]</b> ${esc(d.teks)}`).join(' &middot; ')}</div>`
    : ''
  return `<div class="baris-count">${butir.join('')}</div>${htmlDetail}`
}

function renderPilAlatHtml(alat: AlatGuard): string {
  const palet = WARNA_ALAT_GUARD_HEX[alat] ?? WARNA_ALAT_GUARD_HEX.flag
  const label = LABEL_PENDEK_ALAT_GUARD[alat] ?? alat
  return `<span class="pil-alat" style="background:${palet.latarCetak};border-color:${palet.tepiCetak};color:${palet.teksCetak}">${esc(label)}</span>`
}

function hitungInfoTitikSet(
  drill: Drill | null | undefined,
  urutSets: DrillSet[],
  setId: string | undefined,
  anggota: Member | undefined,
): { koord: string; langkah: string; koreoSet: string } | null {
  if (!drill || !setId || !anggota) return null
  const idx = urutSets.findIndex((s) => s.id === setId)
  if (idx < 0) return null
  const st = urutSets[idx]
  const pt = st.points?.[anggota.id]
  if (!pt) return { koord: 'Istirahat / Prop', langkah: '-', koreoSet: '' }
  const koord = coordText(pt.x, pt.y, drill.field)
  const next = idx < urutSets.length - 1 ? urutSets[idx + 1] : undefined
  const nextPt = next?.points?.[anggota.id]
  let langkah = next ? 'Diam' : 'Akhir'
  if (next && nextPt) {
    const an = analisisPerpindahan(
      st,
      next,
      [anggota],
      stepYd(drill.field),
      drill.tempo,
      drill.beatsPerCount,
      undefined,
      drill.setelanLangkah,
      undefined,
      drill.setelanJarak,
    )
    const met = an.daftar[0]
    const arah = panahArah(nextPt.x - pt.x, nextPt.y - pt.y)
    if (met) {
      langkah = `${Math.round(met.jarakLangkah * 10) / 10} lk ${arah ?? ''}`.trim()
    }
  }
  const koreo = ringkasKoreografiSet(st, {
    memberId: anggota.id,
    sectionId: anggota.section,
    padat: true,
  })
  return {
    koord,
    langkah,
    koreoSet: koreo.join(' · '),
  }
}

/**
 * Bangun dokumen HTML cetak siap A4 / Buku Saku A5 untuk suatu `CountSheet`.
 *
 * Seluruh warna dijamin memakai `#hex` murni (`0` `oklch()` / `color-mix()`).
 */
export function bangunHtmlCetakCountSheet(opsi: OpsiCetakCountSheet): string {
  const { sheet, format, drill, song } = opsi
  const namaTim = opsi.namaTim?.trim() || 'DrillKit'
  const urutSets = [...(opsi.sets ?? [])].sort((a, b) => a.order - b.order)
  const petaSet = new Map(urutSets.map((s, idx) => [s.id, { set: s, nomor: idx + 1 }]))
  const daftarBlok = urutkanBlokCountSheet(sheet.blok)
  const targetPemain: (Member | null)[] =
    opsi.daftarAnggota && opsi.daftarAnggota.length > 0 ? opsi.daftarAnggota : [null]

  const halamanHtml: string[] = []

  for (const m of targetPemain) {
    const tugasProp =
      m && drill?.markers?.length ? tugasKruPropertiAnggota(drill.markers, m.id) : []
    const adaKolomTitik = !!drill && !!m

    if (format === 'a4') {
      const barisTabel = daftarBlok
        .map((bl) => {
          const infoSet = bl.setId ? petaSet.get(bl.setId) : undefined
          const biramaTeks = bl.biramaDari
            ? bl.biramaSampai && bl.biramaSampai !== bl.biramaDari
              ? `Bar ${bl.biramaDari}–${bl.biramaSampai}`
              : `Bar ${bl.biramaDari}`
            : '-'
          const titik = m ? hitungInfoTitikSet(drill, urutSets, bl.setId, m) : null
          const arahTeks = bl.arahHadap ? LABEL_ARAH_HADAP_GUARD[bl.arahHadap] : ''
          const metaTangan = [
            arahTeks ? `Hadap: ${esc(arahTeks)}` : '',
            bl.posisiTangan?.trim() ? `Tangan: <b>${esc(bl.posisiTangan.trim())}</b>` : '',
            bl.catatan?.trim() ? `Catatan: ${esc(bl.catatan.trim())}` : '',
          ]
            .filter(Boolean)
            .join(' &middot; ')

          return `<tr>
            <td>
              <b>${esc(bl.labelBagian)}</b>
              ${infoSet ? `<div class="meta-kecil">${esc(infoSet.set.name || `Set ${infoSet.nomor}`)}</div>` : ''}
            </td>
            <td style="white-space:nowrap">
              <b>${bl.counts} cnt</b>
              <div class="meta-kecil">${esc(biramaTeks)}</div>
            </td>
            ${
              adaKolomTitik
                ? `<td>
                    <div style="font-family:ui-monospace,monospace;font-weight:700">${esc(titik?.koord ?? '-')}</div>
                    <div class="meta-kecil">${esc(titik?.langkah ?? '')}${titik?.koreoSet ? ` &middot; ${esc(titik.koreoSet)}` : ''}</div>
                  </td>`
                : ''
            }
            <td>${renderPilAlatHtml(bl.alat)}</td>
            <td>
              <div><b>${esc(bl.teknik?.trim() || '—')}</b></div>
              ${renderPitaHitunganHtml(bl)}
              ${metaTangan ? `<div class="meta-kecil">${metaTangan}</div>` : ''}
            </td>
          </tr>`
        })
        .join('')

      halamanHtml.push(`<div class="halaman-guard">
        <div class="kepala-guard">
          <div>
            <h1 class="judul-guard">${esc(sheet.judul)}</h1>
            <p class="sub-guard">
              ${esc(namaTim)}
              ${drill ? ` &middot; Formasi: <b>${esc(drill.name)}</b> (${drill.tempo} BPM)` : ''}
              ${song ? ` &middot; Lagu: <b>${esc(song.title)}</b>` : ''}
              &middot; Alat Utama: <b>${esc(LABEL_ALAT_GUARD[sheet.alatUtama])}</b>
            </p>
          </div>
          ${
            m
              ? `<div class="kotak-pemain">
                  <div class="kode-pemain">${esc(m.code)}</div>
                  <div class="nama-pemain">${esc(namaTampil(m))}</div>
                </div>`
              : `<div class="kotak-pemain">
                  <div class="kode-pemain">COUNT SHEET</div>
                  <div class="nama-pemain">Seksi ${esc(sheet.seksi.toUpperCase())}</div>
                </div>`
          }
        </div>
        ${sheet.catatanUmum?.trim() ? `<div class="catatan-umum"><b>Catatan Persiapan Alat:</b> ${esc(sheet.catatanUmum.trim())}</div>` : ''}
        ${tugasProp.length ? `<div class="catatan-umum"><b>Tugas Kru Properti:</b> ${esc(tugasProp.map((mk) => mk.label).join(', '))}</div>` : ''}
        <table class="tabel-cs">
          <thead>
            <tr>
              <th style="width:16%">Bagian / Set</th>
              <th style="width:11%">Count &amp; Bar</th>
              ${adaKolomTitik ? '<th style="width:20%">Koordinat Titik</th>' : ''}
              <th style="width:11%">Alat</th>
              <th>Teknik Kerja, Hitungan (▲ Aksen / ★ Catch), &amp; Tangan</th>
            </tr>
          </thead>
          <tbody>${barisTabel || `<tr><td colspan="${adaKolomTitik ? 5 : 4}">Belum ada blok hitungan.</td></tr>`}</tbody>
        </table>
        <div class="legenda-guard">
          <span>Legenda Hitungan: <b>▲</b> = Aksen / Release &nbsp;&middot;&nbsp; <b>★</b> = Catch (Tangkapan)</span>
          <span>Dicetak luring dari DrillKit</span>
        </div>
      </div>`)
    } else {
      // Format 'buku-saku' (2 kartu A5/A6 siap gunting & lipat per halaman A4)
      const UKURAN_KARTU = 6
      const kelompokKartu: BlokCountSheet[][] = []
      for (let i = 0; i < daftarBlok.length; i += UKURAN_KARTU) {
        kelompokKartu.push(daftarBlok.slice(i, i + UKURAN_KARTU))
      }
      if (kelompokKartu.length === 0) kelompokKartu.push([])

      for (let p = 0; p < kelompokKartu.length; p += 2) {
        const pasang = kelompokKartu.slice(p, p + 2)
        const kartuHtml = pasang
          .map((isi, idxLokal) => {
            const noKartu = p + idxLokal + 1
            const totalKartu = kelompokKartu.length
            const itemHtml = isi
              .map((bl) => {
                const titik = m ? hitungInfoTitikSet(drill, urutSets, bl.setId, m) : null
                const biramaTeks = bl.biramaDari
                  ? bl.biramaSampai && bl.biramaSampai !== bl.biramaDari
                    ? `B.${bl.biramaDari}–${bl.biramaSampai}`
                    : `B.${bl.biramaDari}`
                  : ''
                const aksen = bl.aksenCount?.length ? `▲${bl.aksenCount.join(',')}` : ''
                const tangkap = bl.tangkapCount?.length ? `★Catch ${bl.tangkapCount.join(',')}` : ''
                const penandaPenting = [aksen, tangkap, bl.posisiTangan?.trim()]
                  .filter(Boolean)
                  .join(' · ')
                return `<div class="item-saku">
                  <div class="baris-atas-saku">
                    <span>${esc(bl.labelBagian)} (${bl.counts}c${biramaTeks ? ` · ${esc(biramaTeks)}` : ''})</span>
                    ${renderPilAlatHtml(bl.alat)}
                  </div>
                  ${
                    titik
                      ? `<div style="margin-top:2px"><span class="koord-saku">${esc(titik.koord)}</span> <span class="sub-saku">${esc(titik.langkah)}</span></div>`
                      : ''
                  }
                  <div style="margin-top:2px;color:#0f172a"><b>${esc(bl.teknik?.trim() || '—')}</b></div>
                  ${penandaPenting ? `<div class="meta-kecil">${esc(penandaPenting)}</div>` : ''}
                </div>`
              })
              .join('')

            return `<div class="kartu-saku-guard">
              <div class="kepala-saku">
                <div>
                  <div class="judul-saku">${m ? `${esc(m.code)} · ${esc(namaTampil(m))}` : esc(sheet.judul)}</div>
                  <div class="sub-saku">${esc(sheet.judul)}${drill ? ` · ${esc(drill.name)}` : ''}</div>
                </div>
                <div class="sub-saku">Kartu ${noKartu}/${totalKartu}</div>
              </div>
              ${itemHtml || '<div class="sub-saku">Belum ada blok hitungan.</div>'}
            </div>`
          })
          .join('')

        halamanHtml.push(`<div class="halaman-guard">
          <div class="sub-guard" style="margin-bottom:6px">
            ✂ Buku Saku Visual Color Guard — gunting mengikuti garis putus-putus (${esc(namaTim)})
          </div>
          <div class="grid-saku">${kartuHtml}</div>
        </div>`)
      }
    }
  }

  return printShell(
    `${sheet.judul} — Count Sheet Color Guard`,
    halamanHtml.join('\n'),
    CSS_CETAK_GUARD_HEX,
  )
}
