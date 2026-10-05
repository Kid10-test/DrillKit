/**
 * #5 sisa — Drill × segmen lagu: penggaris hitungan, bantuan hitungan, dan
 * pecah/gabung set.
 *
 * Modul ini **murni** (tanpa DOM, basis data, atau React) supaya bisa diuji
 * langsung dari node — sama seperti `gabungMusik.ts`. Isinya tiga hal yang
 * saling menopang:
 *
 * 1. **Penggaris dua baris.** Peta waktu lagu diterjemahkan ke **hitungan
 *    drill**: baris atas berisi segmen tempo (nama, tempo, rentang hitungan &
 *    birama), baris bawah berisi set (rentang hitungan & birama, plus tanda ⚡
 *    untuk set yang melewati perubahan tempo atau sukat). Sumbu-x-nya
 *    hitungan, bukan birama, karena itulah satuan yang dipakai pelatih saat
 *    menyusun set.
 * 2. **Bantuan hitungan.** "Mulai di hitungan 13 (segmen A · birama 4), sisa
 *    segmen A: 6 hitungan" + berapa hitungan yang harus diisi set ini supaya
 *    berakhir tepat di batas segmen ("Pas ke batas segmen").
 * 3. **Pecah & gabung set.** Pecah di batas segmen atau di hitungan mana pun;
 *    posisi peralihan **diambil dari jalur yang sudah ada** (termasuk busur),
 *    memakai hitungan yang sama persis dengan animasi editor. Gabung
 *    mengembalikan dua set menjadi satu; busur yang berasal dari pecahan yang
 *    sama dijumlahkan kembali sehingga bolak-balik pecah→gabung tidak
 *    kehilangan bentuk jalurnya.
 *
 * Satu hal yang penting untuk dipahami: posisi pada set hasil pecahan dihitung
 * dari **waktu** (porsi durasi set yang berasal dari TempoTimeline), karena
 * itulah yang dipakai animasi. Jadi pada pembagian kecepatan bawaan (`rata`)
 * dan tanpa tunda per section, seluruh posisi hitungan sama persis dengan
 * animasi sebelum dipecah — lurus maupun busur. Pada pembagian kecepatan lain
 * titik pecahnya tetap tepat; hanya bentuk antar-hitungannya yang sedikit
 * berbeda. Untuk jalur **melengkung** yang kuat, kedua bagian memakai
 * kelengkungan hasil penurunan de Casteljau (titik kendali sub-kurva), sehingga
 * sisa simpangannya masih di bawah ±0,15 yard untuk perpindahan 10 yard.
 */

import type { DrillPoint, GerakSet, LatihTempo, TandaBirama } from '../db/types'
import type { TempoLatihan } from './tempoLatihan'
import { labelBirama } from './birama'
import { createTempoTimeline } from './tempoTimeline'
import type { TempoTimeline, TempoTimelineSegment } from './tempoTimeline'
import { kendaliJalur, cocokPutaran, deltaBusur, gerakOf, progresPemain, titikJalur } from './gerak'

/**
 * Lagu dalam bentuk yang dibutuhkan penggaris (tanpa mengimpor tipe Song).
 *
 * `label` ikut dibawa karena baris tempo map yang disimpan memang punya nama
 * segmen ("Bagian A"); `TempoTimelineSegment` sendiri hanya peduli posisinya.
 */
export interface LaguSegmen {
  bpm: number
  tandaBirama: TandaBirama
  tempoMap: (TempoTimelineSegment & { label?: string })[]
  latih?: LatihTempo | null
}

/** Set secukupnya: yang dipakai penggaris hanya jumlah hitungan & namanya. */
export interface SetRingkas {
  counts: number
  name?: string
}

/** Satu blok **segmen** pada baris atas penggaris. */
export interface BlokSegmen {
  index: number
  label: string
  /** tempo di awal segmen */
  bpm: number
  /** tempo di akhir segmen — berbeda dari `bpm` kalau segmennya meluncur */
  bpmAkhir: number
  /** 1 = temponya bergerak di dalam segmen (luncuran/ramp) */
  luncur: boolean
  /** 1 = blok pembuka yang tidak punya baris tempo map sendiri */
  dasar: boolean
  /** hitungan drill (0-based, boleh pecahan) */
  mulai: number
  akhir: number
  hitungan: number
  /** posisi birama lagu (1-based, boleh pecahan) */
  mulaiBirama: number
  akhirBirama: number
  birama: TandaBirama
  mulaiDetik: number
  detik: number
}

/** Satu blok **set** pada baris bawah penggaris. */
export interface BlokSet {
  index: number
  nama: string
  mulai: number
  akhir: number
  hitungan: number
  mulaiBirama: number
  akhirBirama: number
  birama: TandaBirama
  mulaiDetik: number
  detik: number
  bpm: number
  /** tempo tepat sebelum set berakhir (berbeda bila set melewati perubahan) */
  bpmAkhir: number
  /** set ini melewati perubahan tempo di tengahnya */
  lintasTempo: boolean
  /** set ini melewati perubahan sukat di tengahnya */
  lintasSukat: boolean
  /** keterangan siap tampil untuk tanda ⚡ */
  keterangan: string[]
}

export interface PenggarisDrill {
  totalHitungan: number
  totalDetik: number
  segmen: BlokSegmen[]
  set: BlokSet[]
}

/** Bantuan mengisi hitungan satu set. */
export interface BantuanSet {
  ada: boolean
  /** hitungan (1-based) tempat set ini mulai di drill */
  mulaiHitungan: number
  segmen: BlokSegmen | null
  /** sisa segmen pada saat set mulai, dalam hitungan (boleh pecahan) */
  sisa: number
  /** sisa yang dibulatkan ke hitungan terdekat — inilah isi "Pas ke batas segmen" */
  sisaBulat: number
  /** 1 = batas segmen jatuh tepat di batas hitungan */
  tepat: boolean
  teks: string
  teksRinci: string
  bisaPas: boolean
}

const EPS = 1e-6

/** Rapikan angka untuk ditampilkan: bulat tanpa desimal, pecahan satu desimal. */
export function fmtAngka(n: number, desimal = 1): string {
  if (!Number.isFinite(n)) return '—'
  const bulat = Math.round(n)
  if (Math.abs(n - bulat) < 1e-6) return String(bulat)
  return n.toFixed(desimal).replace('.', ',')
}

/**
 * Posisi birama untuk ditampilkan. Bedanya dengan `fmtAngka`: batas yang
 * **hampir** bulat dirapikan dulu, karena `positionAtQuarter(q - ε)` memang
 * berhenti sepersekian kecil sebelum garis birama (5 − 1e-6 → "5", bukan
 * "5,0"), sedangkan ketukan di tengah birama tetap ditulis dua angka di
 * belakang koma (birama 3 ketuk 2 → "3,25").
 */
export function fmtBirama(n: number): string {
  if (!Number.isFinite(n)) return '—'
  const bulat = Math.round(n)
  if (Math.abs(n - bulat) < 5e-3) return String(bulat)
  return n
    .toFixed(2)
    .replace(/0+$/, '')
    .replace(/\.$/, '')
    .replace('.', ',')
}

/** Sisa hitungan dibulatkan ke hitungan terdekat (minimal 1). */
export function bulatkanHitungan(n: number): number {
  return Math.max(1, Math.round(n))
}

/**
 * Bangun kerangka hitungan: quarter-note tiap batas hitungan drill.
 *
 * Ibaratnya penggaris kosong yang belum ditempeli segmen: satu angka untuk
 * setiap hitungan, dihitung dengan aturan yang sama dengan `petakanSetKeMusik`
 * (1 hitungan = `beatsPerCount` ketuk acuan BPM, sukat ikut menentukan).
 */
function kerangka(
  sets: SetRingkas[],
  beatsPerCount: number,
  lagu: LaguSegmen,
): { timeline: TempoTimeline; bpc: number; counts: number[]; qAwal: number[]; total: number; qEnd: number } {
  const bpc = Math.max(0.25, Number.isFinite(beatsPerCount) && beatsPerCount > 0 ? beatsPerCount : 1)
  const timeline = createTempoTimeline({
    bpm: lagu.bpm,
    meter: lagu.tandaBirama,
    segments: lagu.tempoMap ?? [],
    latih: lagu.latih ?? null,
  })
  const counts = sets.map((s) => Math.max(1, Math.floor(s.counts)))
  const total = counts.reduce((a, b) => a + b, 0)
  const qAwal: number[] = [0]
  for (let i = 0; i < counts.length; i += 1) {
    for (let c = 0; c < counts[i]; c += 1) {
      qAwal.push(timeline.advanceTempoBeats(qAwal[qAwal.length - 1], bpc))
    }
  }
  return { timeline, bpc, counts, qAwal, total, qEnd: qAwal[qAwal.length - 1] ?? 0 }
}

/** Ubah posisi quarter menjadi hitungan (0-based, boleh pecahan). */
function hitunganPada(qAwal: number[], total: number, q: number): number {
  if (q <= 0) return 0
  if (q >= (qAwal[total] ?? 0)) return total
  let lo = 0
  let hi = total
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (qAwal[mid] <= q + 1e-9) lo = mid
    else hi = mid - 1
  }
  const q0 = qAwal[lo]
  const q1 = lo < total ? qAwal[lo + 1] : q0
  const step = Math.max(1e-9, q1 - q0)
  return lo + Math.min(1, Math.max(0, (q - q0) / step))
}

/** Perubahan tempo di dalam rentang set, kalau ada. */
function cariLintasTempo(
  timeline: TempoTimeline,
  qAwal: number[],
  mulai: number,
  jumlah: number,
): { di: number; dari: number; ke: number } | null {
  for (let c = 0; c < jumlah; c += 1) {
    const q0 = qAwal[mulai + c]
    const q1 = qAwal[mulai + c + 1]
    const t0 = timeline.tempoAtQuarter(q0)
    const t1 = timeline.tempoAtQuarter(Math.max(q0, q1 - EPS))
    if (Math.abs(t0 - t1) > 1e-6) return { di: mulai + c + 1, dari: t0, ke: t1 }
  }
  return null
}

/** Perubahan sukat yang dilewati rentang set, kalau ada. */
function cariLintasSukat(
  timeline: TempoTimeline,
  biramaAwal: number,
  biramaAkhir: number,
): { birama: number; dari: TandaBirama; ke: TandaBirama } | null {
  const m0 = Math.floor(biramaAwal + 1e-9)
  const m1 = Math.floor(biramaAkhir + 1e-9)
  for (let m = m0 + 1; m <= m1; m += 1) {
    const a = timeline.meterAtMeasure(m - 1)
    const b = timeline.meterAtMeasure(m)
    if (labelBirama(a) !== labelBirama(b)) return { birama: m, dari: a, ke: b }
  }
  return null
}

/** Peta penggaris: segmen di atas, set di bawah, semuanya dalam satuan hitungan. */
export function petaPenggaris(
  sets: SetRingkas[],
  lagu: LaguSegmen,
  opsi: { beatsPerCount: number; latihan?: TempoLatihan | null },
): PenggarisDrill {
  const { timeline, counts, qAwal, total, qEnd } = kerangka(sets, opsi.beatsPerCount, lagu)
  const latihan = opsi.latihan ?? null
  const totalDetik = timeline.secondsAtQuarter(qEnd, latihan)

  /* --------------------------------- Set --------------------------------- */

  let akum = 0
  const blokSet: BlokSet[] = counts.map((n, i) => {
    const mulai = akum
    const akhir = akum + n
    akum = akhir
    const qm = qAwal[mulai]
    const qa = qAwal[akhir]
    const biramaAwal = timeline.positionAtQuarter(qm).measurePosition
    const biramaAkhir = timeline.positionAtQuarter(Math.max(qm, qa - EPS)).measurePosition
    const bpm = timeline.tempoAtQuarter(qm)
    const bpmAkhir = timeline.tempoAtQuarter(Math.max(qm, qa - EPS))
    const lintas = cariLintasTempo(timeline, qAwal, mulai, n)
    const sukat = cariLintasSukat(timeline, biramaAwal, biramaAkhir)
    const keterangan: string[] = []
    if (lintas) {
      const biramaTitik = timeline.positionAtQuarter(qAwal[lintas.di - 1]).measurePosition
      keterangan.push(
        `melewati perubahan tempo ${fmtAngka(lintas.dari)} → ${fmtAngka(lintas.ke)} BPM ` +
          `di hitungan ${lintas.di}, birama ${fmtBirama(biramaTitik)}`,
      )
    }
    if (sukat) {
      keterangan.push(
        `melewati perubahan sukat ${labelBirama(sukat.dari)} → ${labelBirama(sukat.ke)} ` +
          `di birama ${sukat.birama}`,
      )
    }
    return {
      index: i,
      nama: sets[i]?.name?.trim() || `Set ${i + 1}`,
      mulai,
      akhir,
      hitungan: n,
      mulaiBirama: biramaAwal,
      akhirBirama: biramaAkhir,
      birama: timeline.meterAtQuarter(qm + EPS),
      mulaiDetik: timeline.secondsAtQuarter(qm, latihan),
      detik: timeline.secondsBetween(qm, qa, latihan),
      bpm,
      bpmAkhir,
      lintasTempo: !!lintas,
      lintasSukat: !!sukat,
      keterangan,
    }
  })

  /* -------------------------------- Segmen -------------------------------- */

  interface Baris {
    q: number
    label: string
    bpm: number
    dasar: boolean
  }
  const urut = [...(lagu.tempoMap ?? [])]
    .map((s, i) => ({ s, q: timeline.quarterAtPosition(s), i }))
    .sort((a, b) => a.q - b.q || a.i - b.i)
  const baris: Baris[] = []
  // Kalau baris pertama lagu belum mulai di birama 1 (mis. baru di birama 5),
  // awal lagu tetap butuh blok — kalau tidak, penggarisnya bolong.
  if (!urut.length || urut[0].q > EPS) {
    baris.push({ q: 0, label: 'Awal', bpm: lagu.bpm, dasar: true })
  }
  urut.forEach(({ s, q, i }) => {
    baris.push({ q, label: (s.label || `Segmen ${i + 1}`).trim(), bpm: s.bpm, dasar: false })
  })

  const segmen: BlokSegmen[] = []
  for (let i = 0; i < baris.length; i += 1) {
    const q0 = Math.max(0, baris[i].q)
    const q1 = Math.min(qEnd, baris[i + 1]?.q ?? qEnd)
    if (q1 - q0 <= EPS) continue
    const bpm = timeline.tempoAtQuarter(q0 + EPS)
    const bpmAkhir = timeline.tempoAtQuarter(Math.max(q0 + EPS, q1 - EPS))
    const mulai = hitunganPada(qAwal, total, q0)
    const akhir = hitunganPada(qAwal, total, q1)
    segmen.push({
      index: i,
      label: baris[i].label,
      bpm,
      bpmAkhir,
      luncur: Math.abs(bpmAkhir - bpm) > 1e-6,
      dasar: baris[i].dasar,
      mulai,
      akhir,
      hitungan: akhir - mulai,
      mulaiBirama: timeline.positionAtQuarter(q0).measurePosition,
      akhirBirama: timeline.positionAtQuarter(Math.max(q0, q1 - EPS)).measurePosition,
      birama: timeline.meterAtQuarter(q0 + EPS),
      mulaiDetik: timeline.secondsAtQuarter(q0, latihan),
      detik: timeline.secondsBetween(q0, q1, latihan),
    })
  }

  return { totalHitungan: total, totalDetik, segmen, set: blokSet }
}

/**
 * Bantuan mengisi hitungan set: set ini mulai di hitungan berapa, di segmen
 * mana, dan berapa hitungan lagi sampai batas segmennya.
 */
export function bantuanSet(peta: PenggarisDrill, index: number, adaBerikutnya = true): BantuanSet {
  const bersih: BantuanSet = {
    ada: false,
    mulaiHitungan: 0,
    segmen: null,
    sisa: 0,
    sisaBulat: 0,
    tepat: false,
    teks: '',
    teksRinci: '',
    bisaPas: false,
  }
  const blok = peta.set[index]
  if (!blok) return bersih

  // Segmen yang memuat hitungan pertama set ini. Blok "Awal" menutup posisi
  // sebelum baris tempo map yang pertama, jadi selalu ada yang memuat.
  const seg =
    peta.segmen.find((s) => blok.mulai >= s.mulai - 1e-9 && blok.mulai < s.akhir - 1e-9) ??
    peta.segmen[peta.segmen.length - 1] ??
    null
  if (!seg) return { ...bersih, mulaiHitungan: blok.mulai + 1 }

  const sisa = Math.max(0, seg.akhir - blok.mulai)
  const sisaBulat = bulatkanHitungan(sisa)
  const tepat = Math.abs(sisa - Math.round(sisa)) < 1e-6
  const sudahPas = Math.abs(blok.hitungan - Math.round(sisa)) < 1e-6

  const teks =
    `Mulai di hitungan ${fmtAngka(blok.mulai + 1)} (segmen ${seg.label} · ` +
    `birama ${fmtBirama(blok.mulaiBirama)}), sisa segmen ${seg.label}: ${fmtAngka(sisa)} hitungan`
  const teksRinci =
    `${seg.label}: hitungan ${fmtAngka(seg.mulai + 1)}–${fmtAngka(seg.akhir)} · ` +
    `birama ${fmtBirama(seg.mulaiBirama)}–${fmtBirama(seg.akhirBirama)}` +
    (tepat ? '' : ` · batas jatuh di tengah hitungan (dibulatkan ke ${sisaBulat})`) +
    (sudahPas ? ' · set ini sudah berakhir tepat di batas segmen' : '')

  return {
    ada: true,
    mulaiHitungan: blok.mulai + 1,
    segmen: seg,
    sisa,
    sisaBulat,
    tepat,
    teks,
    teksRinci,
    bisaPas: adaBerikutnya && !sudahPas && sisaBulat >= 1,
  }
}

/* ------------------------------- Pecah set -------------------------------- */

export interface PermintaanPecah {
  /** jumlah hitungan set yang akan dipecah */
  counts: number
  /** posisi pemain di set itu */
  points: Record<string, DrillPoint>
  /** gerak dari set ini ke set berikutnya */
  gerak?: GerakSet
  /** posisi pemain di set berikutnya */
  tujuan: Record<string, DrillPoint>
  /** hitungan tempat pecah (1 … counts-1) */
  di: number
  /**
   * Porsi **waktu** (0..1) saat hitungan `di` selesai, dihitung dari
   * TempoTimeline. Bawaannya `di / counts` (tempo datar).
   */
  porsi?: number
  /** section tiap anggota — dipakai untuk tunda mulai per section */
  seksi?: (memberId: string) => string | undefined
}

export interface HasilPecah {
  /** posisi pemain di set peralihan */
  tengah: Record<string, DrillPoint>
  /** gerak set pertama → set peralihan */
  gerakPertama: GerakSet
  /** gerak set peralihan → set berikutnya */
  gerakKedua: GerakSet
  /** hitungan set pertama (setelah pecah) */
  hitunganPertama: number
  /** hitungan set peralihan */
  hitunganKedua: number
}

/** `lengkung` yang menghasilkan kendali paling dekat dengan titik kendali bebas. */
function lengkungDariKendali(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  cx: number,
  cy: number,
): number | null {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy)
  if (len < 1e-9) return null
  const px = -dy / len
  const py = dx / len
  return (2 * ((cx - (x0 + x1) / 2) * px + (cy - (y0 + y1) / 2) * py)) / len
}

/** Titik pada kurva kuadratik delta-space dengan kendali `c`. */
function titikKuadrat(t: number, dx: number, dy: number, cx: number, cy: number): [number, number] {
  const a = 2 * (1 - t) * t
  return [a * cx + t * t * dx, a * cy + t * t * dy]
}

/**
 * Pecah satu perpindahan menjadi dua, pada hitungan ke-`di`.
 *
 * Posisi peralihan diambil dari jalur yang **sudah ada** — bukan interpolasi
 * lurus — dengan fungsi yang sama seperti animasi editor (`progresPemain`,
 * `deltaBusur`, `titikJalur`). Untuk jalur busur, bagian-bagian busurnya
 * dihitung dari sudut & geser yang sama sehingga jumlahnya kembali utuh saat
 * digabung. Untuk jalur melengkung, kelengkungan tiap bagian diturunkan dari
 * kurva aslinya (de Casteljau), dirata-ratakan menurut panjang perpindahan.
 */
export function pecahSet(r: PermintaanPecah): HasilPecah | null {
  const counts = Math.max(1, Math.floor(r.counts))
  if (counts < 2) return null
  const di = Math.min(counts - 1, Math.max(1, Math.round(r.di)))
  const g = gerakOf(r.gerak)
  const putar = g.jalur === 'busur' ? g.putar : undefined
  const geser = putar?.pusatAkhir
    ? { x: putar.pusatAkhir.x - putar.pusat.x, y: putar.pusatAkhir.y - putar.pusat.y }
    : { x: 0, y: 0 }
  const porsi = Math.min(1 - 1e-6, Math.max(1e-6, r.porsi ?? di / counts))
  /** Parameter jalur untuk pemain tanpa tunda — dipakai menurunkan bentuk jalur. */
  const porsiJalur = progresPemain(porsi, g, undefined, counts)

  const tengah: Record<string, DrillPoint> = {}
  let jumlahK1 = 0
  let bobotK1 = 0
  let jumlahK2 = 0
  let bobotK2 = 0

  for (const [id, p] of Object.entries(r.points)) {
    const q = r.tujuan[id]
    if (!q) {
      tengah[id] = { ...p }
      continue
    }
    const t = progresPemain(porsi, g, r.seksi?.(id), counts)
    const dx = q.x - p.x
    const dy = q.y - p.y
    let ox = 0
    let oy = 0
    if (putar && cocokPutaran(p.x, p.y, q.x, q.y, putar.pusat, putar.sudut, geser)) {
      ;[ox, oy] = deltaBusur(t, p.x, p.y, putar.pusat, putar.sudut, geser)
    } else {
      ;[ox, oy] = titikJalur(t, dx, dy, g.jalur === 'lengkung' ? g.lengkung : 0)
    }
    tengah[id] = { ...p, x: p.x + ox, y: p.y + oy }

    // Kelengkungan tiap bagian — hanya untuk jalur melengkung, dan hanya
    // untuk pemain yang memang berpindah.
    if (g.jalur === 'lengkung' && Math.abs(g.lengkung) > 1e-9) {
      const len = Math.hypot(dx, dy)
      if (len > 1e-9) {
        const [cx, cy] = kendaliJalur(dx, dy, g.lengkung)
        const [xq, yq] = titikKuadrat(porsiJalur, dx, dy, cx, cy)
        const k1 = lengkungDariKendali(0, 0, xq, yq, porsiJalur * cx, porsiJalur * cy)
        const k2 = lengkungDariKendali(
          xq,
          yq,
          dx,
          dy,
          (1 - porsiJalur) * cx + porsiJalur * dx,
          (1 - porsiJalur) * cy + porsiJalur * dy,
        )
        if (k1 !== null) {
          jumlahK1 += k1 * len
          bobotK1 += len
        }
        if (k2 !== null) {
          jumlahK2 += k2 * len
          bobotK2 += len
        }
      }
    }
  }

  // Bentuk dasar tiap bagian: jalur, kelengkungan, pembagian kecepatan, dan
  // tunda per section diwarisi apa adanya — yang berubah hanya parameternya.
  const dasar: GerakSet = { ...(r.gerak ?? {}), jalur: g.jalur, lengkung: g.lengkung, mudah: g.mudah }

  if (putar) {
    /*
     * Busur dipecah dengan meneruskan **pusat yang sedang berjalan**:
     * bagian kedua tidak berputar mengelilingi pusat awal, melainkan
     * mengelilingi pusat pada saat pecah (`pusat + geser × porsi`). Itu yang
     * membuat `cocokPutaran` tetap mengenali pemainnya, sehingga garis busurnya
     * benar-benar berakhir tepat di titik peralihan.
     */
    const pusatTengah = {
      x: putar.pusat.x + geser.x * porsiJalur,
      y: putar.pusat.y + geser.y * porsiJalur,
    }
    const punyaGeser = !!putar.pusatAkhir
    return {
      tengah,
      gerakPertama: {
        ...dasar,
        putar: {
          pusat: putar.pusat,
          sudut: putar.sudut * porsiJalur,
          ...(punyaGeser ? { pusatAkhir: pusatTengah } : {}),
        },
      },
      gerakKedua: {
        ...dasar,
        putar: {
          pusat: pusatTengah,
          sudut: putar.sudut * (1 - porsiJalur),
          ...(punyaGeser
            ? { pusatAkhir: { x: putar.pusat.x + geser.x, y: putar.pusat.y + geser.y } }
            : {}),
        },
      },
      hitunganPertama: di,
      hitunganKedua: counts - di,
    }
  }

  const buatLengkung = (lengkungBaru: number | null): GerakSet => {
    if (lengkungBaru !== null && Number.isFinite(lengkungBaru)) {
      // Dibatasi ±1,5: di luar itu kurvanya menekuk sampai menyilang dirinya
      // sendiri, dan itu bukan lagi bentuk yang dimaksud pemakainya.
      return { ...dasar, jalur: 'lengkung', lengkung: Math.max(-1.5, Math.min(1.5, lengkungBaru)) }
    }
    return dasar
  }

  return {
    tengah,
    gerakPertama: buatLengkung(bobotK1 > 0 ? jumlahK1 / bobotK1 : null),
    gerakKedua: buatLengkung(bobotK2 > 0 ? jumlahK2 / bobotK2 : null),
    hitunganPertama: di,
    hitunganKedua: counts - di,
  }
}

/* ------------------------------- Gabung set ------------------------------- */

/**
 * Gabung pengaturan gerak dua set yang berurutan menjadi satu perpindahan.
 *
 * Busur yang berbagi pusat yang sama dijumlahkan sudutnya (dan geser pusatnya)
 * — itulah yang membuat hasil pecah bisa dikembalikan utuh. Kalau kedua busur
 * tidak sepusat, jalurnya diturunkan menjadi lurus: busur gabungan tidak bisa
 * dihitung dari dua busur yang berbeda pusat, dan jalur yang tidak cocok memang
 * diabaikan oleh `cocokPutaran` sehingga lebih jujur dinyatakan lurus.
 */
export function gabungGerak(a?: GerakSet, b?: GerakSet): GerakSet {
  const ga = gerakOf(a)
  const gb = gerakOf(b)
  const tunda: Record<string, number> = { ...ga.tunda }
  for (const [k, v] of Object.entries(gb.tunda)) tunda[k] = (tunda[k] ?? 0) + v
  const adaTunda = Object.values(tunda).some((v) => Math.abs(v) > 1e-9)

  const pa = ga.jalur === 'busur' ? ga.putar : undefined
  const pb = gb.jalur === 'busur' ? gb.putar : undefined
  const samaTitik = (x?: { x: number; y: number }, y?: { x: number; y: number }) =>
    !!x && !!y && Math.hypot(x.x - y.x, x.y - y.y) < 1e-6
  /*
   * Dua busur bisa disambung kalau pusat bagian kedua sama dengan pusat bagian
   * pertama **atau** dengan pusat akhirnya — yang kedua itu justru bentuk hasil
   * pecahan busur yang pusatnya ikut berjalan. Sudutnya lalu menjumlah dan
   * lingkaran terakhirnya memakai pusat akhir bagian kedua.
   */
  const ujungA = pa ? (pa.pusatAkhir ?? pa.pusat) : undefined
  if (pa && pb && (samaTitik(pa.pusat, pb.pusat) || samaTitik(ujungA, pb.pusat))) {
    const ujungB = pb.pusatAkhir ?? pb.pusat
    return {
      jalur: 'busur',
      lengkung: ga.lengkung,
      mudah: ga.mudah,
      ...(adaTunda ? { tunda } : {}),
      putar: {
        pusat: pa.pusat,
        sudut: pa.sudut + pb.sudut,
        ...(samaTitik(pa.pusat, ujungB) ? {} : { pusatAkhir: ujungB }),
      },
    }
  }

  if (ga.jalur === 'busur' || gb.jalur === 'busur') {
    return { jalur: 'lurus', mudah: ga.mudah, ...(adaTunda ? { tunda } : {}) }
  }
  return {
    jalur: ga.jalur,
    lengkung: ga.lengkung,
    mudah: ga.mudah,
    ...(adaTunda ? { tunda } : {}),
  }
}

/* --------------------- Panjang segmen di editor lagu ---------------------- */

export interface PanjangSegmen {
  index: number
  label: string
  measure: number
  /** panjang segmen dalam hitungan drill; null = ujungnya belum ditentukan */
  hitungan: number | null
  mulaiBirama: number
  akhirBirama: number
  birama: TandaBirama
  detik: number
}

/**
 * Panjang tiap segmen tempo **dalam hitungan drill** — dipakai editor lagu
 * supaya pelatih bisa menulis musik dengan satuan yang sama dengan setnya.
 *
 * `akhirBirama` = birama terakhir lagu (M5). Tanpa itu, segmen terakhir
 * panjangnya belum tentu (null) karena lagu boleh berjalan terus.
 */
export function panjangSegmenLagu(
  lagu: LaguSegmen,
  beatsPerCount: number,
  opsi?: { akhirBirama?: number | null },
): PanjangSegmen[] {
  const { timeline } = kerangka([], beatsPerCount, lagu)
  const bpc = Math.max(0.25, Number.isFinite(beatsPerCount) && beatsPerCount > 0 ? beatsPerCount : 1)
  const urut = [...(lagu.tempoMap ?? [])]
    .map((s, i) => ({ s, q: timeline.quarterAtPosition(s), i }))
    .sort((a, b) => a.q - b.q || a.i - b.i)
  if (!urut.length) return []

  const akhirBirama = opsi?.akhirBirama ?? null
  const qUjung =
    akhirBirama && akhirBirama >= 1 ? timeline.quarterAtMeasure(Math.floor(akhirBirama) + 1) : null

  /*
   * Hitungan diukur pada **grid yang sama dengan penggaris drill**: dimulai
   * dari awal lagu, bukan dari awal segmen. Kalau diukur dari awal segmen,
   * angkanya bisa berbeda tipis dari yang terbaca di penggaris (mis. 5,67 vs
   * 5,5) karena batas hitungannya jatuh di tempat lain — dan dua angka yang
   * berbeda untuk hal yang sama persis itulah yang bikin pelatih ragu.
   */
  const batas = Math.max(qUjung ?? 0, urut[urut.length - 1].q)
  const qAwal: number[] = [0]
  {
    let q = 0
    let guard = 0
    while (q < batas - 1e-9 && qAwal.length < 200_000) {
      q = timeline.advanceTempoBeats(q, bpc)
      if (!(q > qAwal[qAwal.length - 1])) break
      qAwal.push(q)
      guard += 1
      if (guard > 200_000) break
    }
  }
  /** Berapa hitungan pada grid itu dari `q0` sampai `q1` (boleh pecahan). */
  const hitunganAntara = (q0: number, q1: number): number => {
    if (q1 <= q0 + 1e-9) return 0
    return Math.max(0, hitunganPada(qAwal, qAwal.length - 1, q1) - hitunganPada(qAwal, qAwal.length - 1, q0))
  }

  return urut.map(({ s, q }, i) => {
    const qNext = urut[i + 1]?.q ?? qUjung
    const hitungan = qNext === null || qNext <= q + 1e-9 ? null : hitunganAntara(q, qNext)
    const qAkhir = qNext === null ? null : Math.max(q, qNext - EPS)
    return {
      index: i,
      label: (s.label || `Segmen ${i + 1}`).trim(),
      measure: s.measure,
      hitungan,
      mulaiBirama: timeline.positionAtQuarter(q).measurePosition,
      akhirBirama: qAkhir === null ? timeline.positionAtQuarter(q).measurePosition : timeline.positionAtQuarter(qAkhir).measurePosition,
      birama: timeline.meterAtQuarter(q + EPS),
      detik: qNext === null ? 0 : timeline.secondsBetween(q, qNext),
    }
  })
}
