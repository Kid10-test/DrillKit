import type {
  AmbangGerak,
  AmbangTingkat,
  DasarJarak,
  DrillSet,
  Member,
  SetelanLangkah,
} from '../db/types'
import { bangunPetaFtl, countEfektifPemain, gerakOf, kelompokPemain } from './gerak'
import { sectionLabel } from './utils'

/**
 * DD3 — Analitik & peringatan gerak.
 *
 * Menghitung **seberapa berat** tiap perpindahan, bukan sekadar seberapa jauh.
 * Hasilnya dipakai untuk:
 *  - panel ringkasan di editor,
 *  - mewarnai jejak menurut kesulitan (peta kesulitan),
 *  - daftar peringatan: pemain yang gerakannya mustahil diselesaikan.
 *
 * Dua hal dari DD2 ikut dihitung di sini, karena keduanya benar-benar
 * memengaruhi berat sebuah gerakan:
 *  - **Jalur melengkung** menempuh jarak lebih panjang daripada garis
 *    lurusnya, walaupun titik awal & akhirnya sama.
 *  - **Tunda mulai** memotong waktu yang tersedia, jadi kecepatannya naik
 *    walaupun jaraknya sama.
 */

/** Kelas kesulitan satu perpindahan. */
export type Tingkat = 'nyaman' | 'padat' | 'berat' | 'mustahil'

export const TINGKAT_LABEL: Record<Tingkat, string> = {
  nyaman: 'Nyaman',
  padat: 'Agak padat',
  berat: 'Berat',
  mustahil: 'Mustahil',
}

/** Warna hex murni (aman untuk laptop lama — tidak ada oklch/color-mix). */
export const TINGKAT_WARNA: Record<Tingkat, string> = {
  nyaman: '#22c55e',
  padat: '#facc15',
  berat: '#fb923c',
  mustahil: '#ef4444',
}

/**
 * Ambang **langkah per menit**.
 *
 * Dasarnya: langkah 8-to-5 = 22,5 inci. Pada tempo 120 BPM dengan 1 ketukan
 * per hitungan, 1 langkah/hitungan = 120 langkah/menit — itu irama jalan
 * biasa. Di atas ~180 langkah/menit pemain praktis harus berlari, dan itu
 * biasanya tidak bisa dilakukan sambil memainkan instrumen/membawa perlengkapan.
 */
export const AMBANG = {
  padat: 120,
  berat: 150,
  mustahil: 180,
} as const

/** Ambang dalam bentuk urutan, dari yang paling ringan. */
export const URUTAN_TINGKAT: Tingkat[] = ['nyaman', 'padat', 'berat', 'mustahil']

/**
 * Ambang **ukuran langkah** (inci) — DD10b.
 *
 * Angkanya diambil dari ukuran langkah yang sudah dikenal tim, jadi tidak
 * perlu menghafal patokan baru: 22,5″ = 8-to-5 (langkah normal), 30″ = 6-to-5,
 * 45″ = 4-to-5 (langkah jauh, jarang dipakai). Di atas 45″ pemain praktis
 * harus melompat, bukan melangkah.
 */
export const AMBANG_LANGKAH = {
  padat: 22.5,
  berat: 30,
  mustahil: 45,
} as const

/**
 * Ambang yang benar-benar dipakai: punya tim kalau diatur, bila tidak yang
 * bawaan. Sengaja dikembalikan lengkap (bukan opsional) supaya pemanggil
 * tidak perlu menulis `??` di mana-mana.
 */
export function ambangEfektif(a?: AmbangGerak): {
  perMenit: AmbangTingkat
  inci: AmbangTingkat
} {
  return {
    perMenit: a?.perMenit ?? { ...AMBANG },
    inci: a?.inci ?? { ...AMBANG_LANGKAH },
  }
}

/**
 * Ambang yang diisi tim bisa saja tidak urut (salah ketik, atau sengaja
 * dibalik). Daripada menghasilkan tingkat yang melompat-lompat, diurutkan
 * dulu — murah, dan membuat sisa perhitungan tidak perlu berjaga-jaga.
 */
function urutkan(a: AmbangTingkat): AmbangTingkat {
  const v = [a.padat, a.berat, a.mustahil].filter((x) => Number.isFinite(x)).sort((x, y) => x - y)
  return { padat: v[0] ?? 0, berat: v[1] ?? v[0] ?? 0, mustahil: v[2] ?? v[1] ?? v[0] ?? 0 }
}

/** Tingkat kesulitan dari **ukuran langkah** (inci), bukan kecepatan. */
export function tingkatLangkahDari(inci: number, ambang?: AmbangTingkat): Tingkat {
  const a = urutkan(ambang ?? AMBANG_LANGKAH)
  if (inci > a.mustahil) return 'mustahil'
  if (inci > a.berat) return 'berat'
  if (inci > a.padat) return 'padat'
  return 'nyaman'
}

export function tingkatDari(langkahPerMenit: number, ambang?: AmbangTingkat): Tingkat {
  const a = urutkan(ambang ?? AMBANG)
  if (langkahPerMenit > a.mustahil) return 'mustahil'
  if (langkahPerMenit > a.berat) return 'berat'
  if (langkahPerMenit > a.padat) return 'padat'
  return 'nyaman'
}

/**
 * Yang lebih berat dari dua tingkat.
 *
 * Dipakai menjawab satu pertanyaan yang dulu tidak pernah dijawab analitik:
 * "apakah gerakan ini berat?" Gerakan bisa ringan di kecepatan tapi mustahil
 * di ukuran langkah (langkah raksasa pelan), atau sebaliknya. Jawabannya
 * harus yang lebih buruk, karena pemain menghadapi keduanya sekaligus.
 */
export function lebihBerat(a: Tingkat, b: Tingkat): Tingkat {
  return URUTAN_TINGKAT.indexOf(a) >= URUTAN_TINGKAT.indexOf(b) ? a : b
}

/**
 * Perbandingan panjang kurva terhadap garis lurusnya.
 *
 * Jalur melengkung DD2 adalah kurva kuadratik dari (0,0) ke (1,0) dengan titik
 * kendali (0,5; l/2). Panjangnya bisa dihitung tepat:
 *
 *   ∫₀¹ √(1 + l²(1−2t)²) dt = ½√(1+l²) + asinh(l)/(2l)
 *
 * Jadi `lengkung = 1` membuat jarak tempuh ~14,8% lebih panjang dari garis
 * lurus, walaupun titik awal & akhirnya sama.
 */
export function rasioLengkung(lengkung: number): number {
  if (!lengkung) return 1
  const l = Math.abs(lengkung)
  return Math.sqrt(1 + l * l) / 2 + Math.asinh(l) / (2 * l)
}

/** Metrik satu perpindahan satu pemain. */
export interface MetrikPemain {
  id: string
  nama: string
  seksi: string
  /** Jarak tempuh mengikuti jalur (yard) — sudah termasuk tambahan lengkungan. */
  jarakYd: number
  /** Jarak tempuh dalam langkah 8-to-5. */
  jarakLangkah: number
  /** Langkah per hitungan pada waktu yang benar-benar tersedia. */
  langkahPerCount: number
  /** Langkah per menit — ukuran berat yang sudah memerhitungkan tempo. */
  langkahPerMenit: number
  /** DD10b — ukuran langkah yang dipakai (inci). Tetap bila mode `tetap`. */
  ukuranLangkahInci: number
  /** Tingkat dari kecepatan (langkah per menit). */
  tingkat: Tingkat
  /** DD10b — tingkat dari ukuran langkah: mampukah kakinya melangkah sejauh itu? */
  tingkatLangkah: Tingkat
  /** Yang lebih buruk dari keduanya — jawaban untuk "apakah gerakan ini berat?". */
  tingkatAkhir: Tingkat
}

/** Ringkasan satu section. */
export interface MetrikSeksi {
  seksi: string
  label: string
  jml: number
  rata: number
  terberat: number
  /** Tingkat dari kecepatan saja. */
  tingkat: Tingkat
  /** Yang lebih buruk antara kecepatan & ukuran langkah di section ini. */
  tingkatAkhir: Tingkat
  /**
   * Tingkat dari **ukuran langkah saja** di section ini.
   *
   * Perlu dipisah dari `tingkatAkhir` supaya yang menyampaikan pesan tidak
   * menyalahkan hal yang keliru: section bisa berstatus "mustahil" karena
   * kecepatannya, sementara langkahnya 22,5 inci yang sebenarnya nyaman.
   * Mengatakan "langkah 22,5″ mustahil" akan membuat pelatih memperbaiki
   * ukuran langkah — padahal yang perlu diubah jumlah count-nya.
   */
  tingkatLangkah: Tingkat
  /** Ukuran langkah terbesar di section ini (inci). */
  langkahTerbesarInci: number
}

/** Hasil analisis satu perpindahan (dari satu set ke set berikutnya). */
export interface HasilAnalisis {
  /** Semua pemain yang berpindah, terberat lebih dulu. */
  daftar: MetrikPemain[]
  /** Ringkasan per section, terberat lebih dulu. */
  seksi: MetrikSeksi[]
  /** Pemain yang masuk kelas "berat" atau "mustahil" — kecepatan ATAU ukuran langkah. */
  peringatan: MetrikPemain[]
  /** Ukuran langkah terbesar di perpindahan ini (inci). */
  langkahTerbesarInci: number
  terjauh: MetrikPemain | null
  tercepat: MetrikPemain | null
  rata: number
}

const KOSONG: HasilAnalisis = {
  daftar: [],
  seksi: [],
  peringatan: [],
  terjauh: null,
  tercepat: null,
  rata: 0,
  langkahTerbesarInci: 0,
}

/**
 * Analisis perpindahan dari `dari` ke `ke`.
 *
 * - `stepYd`      — panjang satu langkah dalam yard (8-to-5 → 0,625).
 * - `tempo`       — BPM drill.
 * - `beatsPerCount` — ketukan per hitungan (1 atau 2).
 * - `hanya`       — kalau diisi, cuma pemain ini yang dihitung (mode 1 section).
 */
export function analisisPerpindahan(
  dari: DrillSet | undefined,
  ke: DrillSet | undefined,
  anggota: Member[],
  stepYd: number,
  tempo: number,
  beatsPerCount: number,
  hanya?: Set<string>,
  /** DD10b — bawaan cara langkah dihitung, dipakai bila set tidak mengaturnya. */
  bawaanLangkah?: SetelanLangkah,
  /** Ambang kesulitan punya tim; bila kosong dipakai yang bawaan. */
  ambang?: AmbangGerak,
  /**
   * 31e — dasar jarak: `jalur` menghitung jarak tempuh kaki (mengikuti
   * kelengkungan), `lurus` menghitung perpindahan dari awal ke akhir.
   * Kosong = `jalur`, persis seperti sebelumnya.
   */
  dasarJarak?: DasarJarak,
): HasilAnalisis {
  if (!dari || !ke) return KOSONG
  const counts = Math.max(0, dari.counts)
  if (counts <= 0) return KOSONG
  const amb = ambangEfektif(ambang)

  const g = gerakOf(dari.gerak)
  // 31e — kalau desainer memilih jarak lurus, kelengkungan & FTL diabaikan:
  // yang dihitung perpindahan titik awal → akhir, bukan jarak tempuh kaki.
  const rasioDasar =
    dasarJarak === 'lurus' ? 1 : g.jalur === 'lengkung' ? rasioLengkung(g.lengkung) : 1
  const petaFtlYd =
    dasarJarak !== 'lurus' && g.kelompok?.length
      ? bangunPetaFtl(g.kelompok, dari.points, ke.points)
      : new Map()
  const perMenit = Math.max(1, tempo) / Math.max(1, beatsPerCount)

  const daftar: MetrikPemain[] = []
  for (const m of anggota) {
    if (hanya && !hanya.has(m.id)) continue
    const p = dari.points[m.id]
    const q = ke.points[m.id]
    if (!p || !q) continue
    const ftl = petaFtlYd.get(m.id)
    const klp = kelompokPemain(g, m.id)
    const lurusYd = Math.hypot(q.x - p.x, q.y - p.y)
    const jarakYd = ftl
      ? ftl.totalPanjang
      : dasarJarak === 'lurus'
        ? lurusYd
        : klp
          ? lurusYd * (klp.jalur === 'lengkung' ? rasioLengkung(klp.lengkung ?? 0.4) : 1)
          : lurusYd * rasioDasar
    if (jarakYd < 0.01) continue
    // Waktu yang benar-benar tersedia buat pemain ini (memperhitungkan
    // Move+Hold `jalanCount`, `tunda` per seksi, dan gelombang `ripple`).
    const sisa = countEfektifPemain(g, m.section, counts, m.id)

    /**
     * DD10b — dua cara menghitung langkah, dipilih per pemain per perpindahan.
     *
     *  - **`tetap`** — ukuran langkah dikunci (8-to-5 = 22,5″). Jumlah langkah
     *    ditentukan jaraknya; yang menyesuaikan **kecepatannya**. Jarak dekat
     *    dalam hitungan panjang jadi jalan pelan.
     *  - **`menyesuaikan`** — jumlah langkah ditentukan **hitungannya**
     *    (`sisa × langkahPerCount`), lalu **ukuran langkahnya** yang
     *    mengecil/membesar. Ritme tetap sama, yang menyesuaikan panjang
     *    langkahnya — karena itulah kolom ukuran langkah jadi yang penting.
     */
    const setel = dari.langkah?.[m.id] ?? bawaanLangkah ?? { mode: 'tetap' as const }
    let jarakLangkah: number
    let langkahPerCount: number
    let ukuranLangkahInci: number
    if (setel.mode === 'menyesuaikan' && sisa > 0) {
      const k = Math.max(0.1, setel.langkahPerCount ?? 1)
      jarakLangkah = sisa * k
      ukuranLangkahInci = jarakLangkah > 0 ? (jarakYd / jarakLangkah) * 36 : Infinity
      langkahPerCount = k
    } else {
      jarakLangkah = jarakYd / stepYd
      ukuranLangkahInci = stepYd * 36
      langkahPerCount = sisa > 0 ? jarakLangkah / sisa : Infinity
    }
    const langkahPerMenit = langkahPerCount * perMenit
    daftar.push({
      id: m.id,
      nama: m.name,
      seksi: m.section,
      jarakYd,
      jarakLangkah,
      langkahPerCount,
      langkahPerMenit,
      ukuranLangkahInci,
      tingkat: tingkatDari(langkahPerMenit, amb.perMenit),
      tingkatLangkah: tingkatLangkahDari(ukuranLangkahInci, amb.inci),
      tingkatAkhir: lebihBerat(
        tingkatDari(langkahPerMenit, amb.perMenit),
        tingkatLangkahDari(ukuranLangkahInci, amb.inci),
      ),
    })
  }
  if (!daftar.length) return KOSONG

  daftar.sort((a, b) => b.langkahPerMenit - a.langkahPerMenit)

  // Ringkasan per section.
  const peta = new Map<string, MetrikPemain[]>()
  for (const d of daftar) {
    const isi = peta.get(d.seksi)
    if (isi) isi.push(d)
    else peta.set(d.seksi, [d])
  }
  const seksi: MetrikSeksi[] = [...peta.entries()].map(([k, isi]) => {
    const total = isi.reduce((a, b) => a + b.langkahPerMenit, 0)
    // Ukuran langkah terbesar dipakai, bukan rata-rata: satu pemain yang
    // diminta melangkah 70 inci sudah cukup jadi masalah walau yang lain aman.
    const palingJauh = isi.reduce((a, b) => (b.ukuranLangkahInci > a.ukuranLangkahInci ? b : a), isi[0])
    return {
      seksi: k,
      label: sectionLabel(k),
      jml: isi.length,
      rata: total / isi.length,
      terberat: isi[0].langkahPerMenit,
      tingkat: tingkatDari(isi[0].langkahPerMenit, amb.perMenit),
      tingkatAkhir: isi.reduce((a, b) => lebihBerat(a, b.tingkatAkhir), 'nyaman' as Tingkat),
      tingkatLangkah: isi.reduce(
        (a, b) => lebihBerat(a, b.tingkatLangkah),
        'nyaman' as Tingkat,
      ),
      langkahTerbesarInci: Number.isFinite(palingJauh.ukuranLangkahInci)
        ? palingJauh.ukuranLangkahInci
        : 0,
    }
  })
  seksi.sort((a, b) => b.rata - a.rata)

  const rata = daftar.reduce((a, b) => a + b.langkahPerMenit, 0) / daftar.length
  const terbesar = daftar.reduce(
    (a, b) => (Number.isFinite(b.ukuranLangkahInci) && b.ukuranLangkahInci > a ? b.ukuranLangkahInci : a),
    0,
  )
  return {
    daftar,
    seksi,
    // Dulu hanya kecepatan yang diperingatkan — itulah sebabnya analitik bisa
    // berkata "semua nyaman" sementara buku saku merah semua.
    peringatan: daftar.filter((d) => d.tingkatAkhir === 'berat' || d.tingkatAkhir === 'mustahil'),
    terjauh: daftar.reduce((a, b) => (b.jarakLangkah > a.jarakLangkah ? b : a), daftar[0]),
    tercepat: daftar[0],
    rata,
    langkahTerbesarInci: terbesar,
  }
}

/** Set terberat di seluruh drill — dipakai untuk ringkasan sekilas. */
export function setTerberat(
  sets: DrillSet[],
  anggota: Member[],
  stepYd: number,
  tempo: number,
  beatsPerCount: number,
  /**
   * M1 — tempo per set kalau drill ditautkan ke lagu. Kalau diisi, tiap
   * perpindahan dinilai dengan tempo lagu pada set itu, supaya peringatan
   * "terlalu berat" tidak dihitung dengan tempo yang berbeda dari yang
   * benar-benar diputar.
   */
  tempoPerSet?: number[],
  /** Ambang kesulitan punya tim; bila kosong dipakai yang bawaan. */
  ambang?: AmbangGerak,
): {
  urutan: number
  nama: string
  rata: number
  tingkat: Tingkat
  langkahTerbesarInci: number
} | null {
  let terburuk: {
    urutan: number
    nama: string
    rata: number
    tingkat: Tingkat
    langkahTerbesarInci: number
  } | null = null
  for (let i = 0; i < sets.length - 1; i++) {
    const tempoSetIni = tempoPerSet?.[i] ?? tempo
    const h = analisisPerpindahan(
      sets[i],
      sets[i + 1],
      anggota,
      stepYd,
      tempoSetIni,
      beatsPerCount,
      undefined,
      undefined,
      ambang,
    )
    if (!h.daftar.length) continue
    // Yang paling berat di set ini, dari kecepatan maupun ukuran langkah.
    const tingkatSet = h.daftar.reduce(
      (a, b) => lebihBerat(a, b.tingkatAkhir),
      'nyaman' as Tingkat,
    )
    // Bandingkan tingkatnya dulu, baru kecepatannya: set dengan langkah
    // raksasa tapi pelan tetap lebih bermasalah daripada set yang cepat
    // dengan langkah wajar.
    const lebihParah =
      !terburuk ||
      URUTAN_TINGKAT.indexOf(tingkatSet) > URUTAN_TINGKAT.indexOf(terburuk.tingkat) ||
      (tingkatSet === terburuk.tingkat && h.rata > terburuk.rata)
    if (lebihParah) {
      terburuk = {
        urutan: i + 1,
        nama: sets[i].name,
        rata: h.rata,
        tingkat: tingkatSet,
        langkahTerbesarInci: h.langkahTerbesarInci,
      }
    }
  }
  return terburuk
}
