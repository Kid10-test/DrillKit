/**
 * #29 — Pelatih Ketepatan Ketuk (*Silent-Bar Rhythm Coach*): logika murni.
 *
 * Pemain mengetuk layar mengikuti metronom yang **sesekali diam** (birama
 * hening, lihat `PolaHening` di metronome.ts). Saat klik berbunyi, mudah
 * mengikuti; saat senyap, yang tersisa hanya **tempo batin** pemain — dan
 * di situlah tergesa/terseret ketahuan.
 *
 * Masukan: daftar sasaran (waktu ketukan dari `InfoKetuk.waktu`, plus
 * penanda hening) dan daftar waktu ketukan jari (jam yang sama, sudah
 * dikoreksi jeda keluaran audio). Keluaran: pasangan ketukan↔sasaran,
 * rata-rata selisih bertanda (± ms), rata-rata mutlak, sebaran, dan
 * pembagian bunyi vs hening.
 */

export interface SasaranKetuk {
  /** detik (jam AudioContext) */
  waktu: number
  /** jatuh di birama hening */
  hening: boolean
}

export interface PasanganKetuk {
  sasaran: number
  ketuk: number
  /** ketuk − sasaran, ms (negatif = mendahului / tergesa) */
  selisihMs: number
  hening: boolean
}

export interface StatKetuk {
  n: number
  /** rata-rata bertanda (ms) */
  rataMs: number
  /** rata-rata mutlak (ms) */
  rataAbsMs: number
  /** simpangan baku (ms) — konsistensi */
  sebaranMs: number
}

export interface HasilKetuk {
  pasangan: PasanganKetuk[]
  /** sasaran yang tidak diketuk sama sekali */
  terlewat: number
  /** ketukan yang tidak dekat sasaran mana pun */
  ketukLebih: number
  semua: StatKetuk
  bunyi: StatKetuk
  hening: StatKetuk
  /** persentase sasaran yang diketuk dalam toleransi (0–100) */
  persenTepat: number
  toleransiMs: number
}

/** Toleransi "tepat" bawaan (ms) — kira-kira sepersepuluh detik dibagi tiga. */
export const TOLERANSI_KETUK_MS = 35

function stat(xs: number[]): StatKetuk {
  if (!xs.length) return { n: 0, rataMs: 0, rataAbsMs: 0, sebaranMs: 0 }
  const m = xs.reduce((a, b) => a + b, 0) / xs.length
  const abs = xs.reduce((a, b) => a + Math.abs(b), 0) / xs.length
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - m) * (b - m), 0) / xs.length)
  return { n: xs.length, rataMs: Math.round(m), rataAbsMs: Math.round(abs), sebaranMs: Math.round(sd) }
}

/**
 * Cocokkan ketukan dengan sasaran dan nilai.
 *
 * Tiap sasaran punya **jendela** setengah jarak ke sasaran tetangganya
 * (maks. 250 ms), jadi satu ketukan tidak mungkin dihitung dua kali dan
 * ketukan asal-asalan di antara dua ketukan tidak dipaksa jadi "terlambat
 * sekali". Bila dua ketukan berebut satu sasaran, yang lebih dekat menang;
 * yang kalah dihitung `ketukLebih`.
 *
 * `sampai` (detik): sasaran sesudahnya diabaikan — pemain berhenti, ketukan
 * yang belum sempat tiba bukan "terlewat". `dari`: abaikan sasaran sebelum
 * pemain mulai mengetuk (memberi waktu masuk).
 */
export function nilaiKetukan(
  sasaranMasuk: SasaranKetuk[],
  ketukan: number[],
  opsi: { dari?: number; sampai?: number; toleransiMs?: number } = {},
): HasilKetuk {
  const tol = opsi.toleransiMs ?? TOLERANSI_KETUK_MS
  const semuaSasaran = [...sasaranMasuk].sort((a, b) => a.waktu - b.waktu)
  const ketuk = [...ketukan].filter(Number.isFinite).sort((a, b) => a - b)
  const dari = opsi.dari ?? (ketuk.length ? ketuk[0] - 0.25 : Infinity)
  const sampai = opsi.sampai ?? (ketuk.length ? ketuk[ketuk.length - 1] + 0.25 : -Infinity)
  const sasaran = semuaSasaran.filter((s) => s.waktu >= dari && s.waktu <= sampai)

  const jendela = sasaran.map((s, i) => {
    const kiri = i > 0 ? s.waktu - sasaran[i - 1].waktu : Infinity
    const kanan = i + 1 < sasaran.length ? sasaran[i + 1].waktu - s.waktu : Infinity
    const j = Math.min(kiri, kanan, 0.5) / 2
    return Number.isFinite(j) ? j : 0.25
  })

  /** milik[sasaran] = indeks ketukan terdekat yang diterima */
  const milik = new Map<number, number>()
  let ketukLebih = 0
  let mulai = 0
  for (let k = 0; k < ketuk.length; k++) {
    const t = ketuk[k]
    while (mulai < sasaran.length && sasaran[mulai].waktu + jendela[mulai] < t) mulai++
    let pilih = -1
    let jarak = Infinity
    for (let i = Math.max(0, mulai - 1); i < sasaran.length && sasaran[i].waktu - jendela[i] <= t; i++) {
      const d = Math.abs(t - sasaran[i].waktu)
      if (d <= jendela[i] && d < jarak) {
        pilih = i
        jarak = d
      }
    }
    if (pilih < 0) {
      ketukLebih++
      continue
    }
    const lama = milik.get(pilih)
    if (lama === undefined) milik.set(pilih, k)
    else {
      ketukLebih++
      if (Math.abs(ketuk[lama] - sasaran[pilih].waktu) > jarak) milik.set(pilih, k)
    }
  }

  const pasangan: PasanganKetuk[] = [...milik.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([i, k]) => ({
      sasaran: sasaran[i].waktu,
      ketuk: ketuk[k],
      selisihMs: Math.round((ketuk[k] - sasaran[i].waktu) * 1000),
      hening: sasaran[i].hening,
    }))
  const tepat = pasangan.filter((p) => Math.abs(p.selisihMs) <= tol).length
  return {
    pasangan,
    terlewat: sasaran.length - pasangan.length,
    ketukLebih,
    semua: stat(pasangan.map((p) => p.selisihMs)),
    bunyi: stat(pasangan.filter((p) => !p.hening).map((p) => p.selisihMs)),
    hening: stat(pasangan.filter((p) => p.hening).map((p) => p.selisihMs)),
    persenTepat: sasaran.length ? Math.round((tepat / sasaran.length) * 100) : 0,
    toleransiMs: tol,
  }
}

const bertanda = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : '±0')

/** Arah kecenderungan dari rata-rata bertanda. */
export function arahKetuk(rataMs: number, ambang = 12): 'tepat' | 'tergesa' | 'terseret' {
  if (rataMs <= -ambang) return 'tergesa'
  if (rataMs >= ambang) return 'terseret'
  return 'tepat'
}

/**
 * Kalimat umpan balik siap tampil. Yang paling berharga adalah
 * **perbandingan bunyi vs hening**: pemain yang tepat saat klik berbunyi
 * tetapi bergeser saat senyap belum punya tempo batin yang mandiri.
 */
export function vonisKetuk(h: HasilKetuk): string[] {
  const out: string[] = []
  if (!h.pasangan.length) return ['Belum ada ketukan yang cocok dengan ketukan metronom.']
  const a = arahKetuk(h.semua.rataMs)
  out.push(
    a === 'tepat'
      ? `Rata-rata ${bertanda(h.semua.rataMs)} ms — pas di ketukan.`
      : a === 'tergesa'
        ? `Rata-rata ${bertanda(h.semua.rataMs)} ms — cenderung TERGESA (mendahului ketukan).`
        : `Rata-rata ${bertanda(h.semua.rataMs)} ms — cenderung TERSERET (di belakang ketukan).`,
  )
  out.push(`Konsistensi ±${h.semua.sebaranMs} ms · ${h.persenTepat}% ketukan dalam ±${h.toleransiMs} ms.`)
  if (h.bunyi.n >= 2 && h.hening.n >= 2) {
    const geser = h.hening.rataMs - h.bunyi.rataMs
    if (Math.abs(geser) < 15 && h.hening.sebaranMs <= h.bunyi.sebaranMs + 15) {
      out.push('Saat klik diam kamu tetap stabil — tempo batinmu sudah mandiri.')
    } else if (geser <= -15) {
      out.push(`Saat klik diam kamu bergeser ${bertanda(geser)} ms — tempo batin terlalu CEPAT; tahan dorongan untuk maju.`)
    } else if (geser >= 15) {
      out.push(`Saat klik diam kamu bergeser ${bertanda(geser)} ms — tempo batin MELAMBAT; jaga hitungan tetap hidup di kepala.`)
    } else {
      out.push(`Saat klik diam ketukanmu melebar (±${h.hening.sebaranMs} ms) — latih hitungan subdivisi di kepala.`)
    }
  }
  if (h.terlewat > 0) out.push(`${h.terlewat} ketukan terlewat.`)
  if (h.ketukLebih > 0) out.push(`${h.ketukLebih} ketukan di luar ketukan metronom.`)
  return out
}
