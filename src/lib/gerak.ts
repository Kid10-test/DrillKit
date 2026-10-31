import type {
  DrillSet,
  GerakKelompok,
  GerakSet,
  JenisSimbolVisual,
} from '../db/types'

/**
 * DD2 & #16 — Jalur, pembagian gerak, FTL, Move+Hold, Ripple, & simbol visual.
 *
 * Modul ini sengaja terpisah supaya **editor**, **presenter**, **mode anggota**,
 * dan **gambar jejak / buku saku** memakai hitungan yang sama persis — kalau
 * salah satu diubah, semuanya ikut.
 */

/**
 * Pengaturan gerak yang sudah dilengkapi nilai bawaan.
 * Kolom lanjutan (`putar`, `jalanCount`, `ripple`, `kelompok`) tetap opsional.
 */
export type GerakLengkap = Required<
  Omit<GerakSet, 'putar' | 'jalanCount' | 'ripple' | 'kelompok'>
> & {
  putar?: GerakSet['putar']
  jalanCount?: GerakSet['jalanCount']
  ripple?: GerakSet['ripple']
  kelompok?: GerakSet['kelompok']
}

/** Nilai bawaan gerak: lurus, rata, tanpa tunda, tanpa putaran. */
export const GERAK_DEFAULT: GerakLengkap = {
  jalur: 'lurus',
  lengkung: 0,
  mudah: 'rata',
  tunda: {},
}

/** Pengaturan gerak sebuah set — aman untuk set lama yang belum punya. */
export function gerakOf(g?: GerakSet): GerakLengkap {
  return { ...GERAK_DEFAULT, ...(g ?? {}) }
}

/**
 * **Pembagian kecepatan (easing).**
 * Mengubah progres *waktu* (0..1) menjadi progres *gerak* (0..1).
 *
 * - `rata`      — kecepatan konstan (perilaku lama).
 * - `halus`     — pelan di awal & akhir (paling mirip gerakan manusia).
 * - `mulaiPelan`— pelan di awal, lalu lancar (cocok untuk "mark time" dulu).
 * - `akhirPelan`— lancar lalu melambat saat tiba (cocok untuk set berhenti).
 */
export function ease(t: number, jenis: GerakLengkap['mudah']): number {
  const p = Math.min(1, Math.max(0, t))
  switch (jenis) {
    case 'halus':
      return p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2
    case 'mulaiPelan':
      return p * p
    case 'akhirPelan':
      return 1 - Math.pow(1 - p, 2)
    default:
      return p
  }
}

/**
 * Titik pada jalur perpindahan, **relatif terhadap posisi awal**, dalam ruang
 * gambar (bukan yard).
 *
 * `lengkung === 0` menghasilkan garis lurus. Selain itu dipakai kurva
 * kuadratik: titik kendalinya berada di tengah-tengah, digeser tegak lurus
 * sejauh `lengkung × setengah panjang perpindahan`.
 */
export function titikJalur(t: number, dx: number, dy: number, lengkung: number): [number, number] {
  const p = Math.min(1, Math.max(0, t))
  if (!lengkung) return [dx * p, dy * p]
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return [0, 0]
  // Sumbu tegak lurus terhadap arah gerak.
  const ux = dx / len
  const uy = dy / len
  const px = -uy
  const py = ux
  const busur = lengkung * len * 0.5
  // Titik kendali kurva kuadratik.
  const cx = dx / 2 + px * busur
  const cy = dy / 2 + py * busur
  // B(t) dengan titik awal (0,0): 2(1-t)t·C + t²·Tujuan
  const a = 2 * (1 - p) * p
  const bq = p * p
  return [a * cx + bq * dx, a * cy + bq * dy]
}

/** Titik kendali kurva (dipakai untuk menggambar jejak melengkung). */
export function kendaliJalur(dx: number, dy: number, lengkung: number): [number, number] {
  if (!lengkung) return [dx / 2, dy / 2]
  const len = Math.hypot(dx, dy)
  if (len < 1e-6) return [0, 0]
  return [dx / 2 + -dy / len * (lengkung * len * 0.5), dy / 2 + dx / len * (lengkung * len * 0.5)]
}

/**
 * Pecahan tunda (0..1) untuk sebuah section.
 * `tunda` disimpan dalam **count**, lalu dibagi jumlah count set ini.
 * Dibatasi 0,9 supaya pemain yang paling telat masih sempat bergerak.
 */
export function tundaFraksi(
  g: GerakLengkap,
  sectionId: string | undefined,
  counts: number,
): number {
  const c = Math.max(1, counts)
  const d = sectionId ? g.tunda[sectionId] ?? 0 : 0
  return Math.min(0.9, Math.max(0, d / c))
}

/** Cari sub-kelompok gerak tempat pemain ini terdaftar (bila ada). */
export function kelompokPemain(
  g: Pick<GerakSet, 'kelompok'> | undefined,
  memberId: string | undefined,
): GerakKelompok | undefined {
  if (!g?.kelompok?.length || !memberId) return undefined
  return g.kelompok.find((k) => k.memberIds.includes(memberId))
}

/** Label gelombang Ripple (0 -> 'A', 1 -> 'B', ..., 25 -> 'Z', 26 -> '27'). */
export function labelGelombangRipple(indeks: number): string {
  const n = Math.max(0, Math.floor(indeks))
  if (n < 26) return String.fromCharCode(65 + n)
  return String(n + 1)
}

/**
 * Progres gerak **pemain ini** pada progres waktu set `p` (0..1).
 *
 * Mendukung gabungan mulus dari:
 * - `tunda` mulai per section (DD2),
 * - `ripple` gelombang per pemain (`#16`: mode `kejar` maupun `bertahap`),
 * - `jalanCount` pembagian *Move + Hold* (`#16`: mis. Jalan 12 + Hold 4),
 * - override `mudah` & `jalanCount` per sub-kelompok (`GerakKelompok`).
 */
export function progresPemain(
  p: number,
  g: GerakLengkap,
  sectionId: string | undefined,
  counts: number,
  memberId?: string,
): number {
  const pJepit = Math.min(1, Math.max(0, p))
  const totalCount = Math.max(1, counts)
  const klp = kelompokPemain(g, memberId)
  const mudahEfektif = klp?.mudah ?? g.mudah

  // Hitungan jalan efektif (Move + Hold)
  const rawJalan = klp?.jalanCount ?? g.jalanCount
  const adaHold = typeof rawJalan === 'number' && rawJalan > 0 && rawJalan < totalCount
  const jalanCount = adaHold ? rawJalan : totalCount

  // Hitungan tunda gabungan (section + gelombang ripple per pemain)
  const tundaSeksiCount = sectionId ? Math.max(0, g.tunda[sectionId] ?? 0) : 0
  const gelRipple =
    memberId && g.ripple && typeof g.ripple.urutan?.[memberId] === 'number'
      ? Math.max(0, g.ripple.urutan[memberId])
      : 0
  const tundaRippleCount = g.ripple ? gelRipple * Math.max(0, g.ripple.selangCount || 0) : 0
  const totalTundaCount = tundaSeksiCount + tundaRippleCount

  if (g.ripple?.mode === 'bertahap' && tundaRippleCount > 0) {
    // Mode bertahap: tiap gelombang bergerak sepanjang durasi `jalanCount`
    // (atau sisa count yang tersedia agar tetap tiba <= akhir set).
    const mulai = Math.min(totalCount * 0.9, totalTundaCount)
    const durasi = Math.max(totalCount * 0.1, Math.min(jalanCount, totalCount - mulai))
    const mulaiF = mulai / totalCount
    const akhirF = (mulai + durasi) / totalCount
    if (pJepit <= mulaiF) return 0
    if (pJepit >= akhirF) return 1
    return ease((pJepit - mulaiF) / (akhirF - mulaiF), mudahEfektif)
  }

  // Mode bawaan ('kejar') + Move + Hold:
  // Seluruh pemain selesai bergerak pada `akhirF = jalanCount / totalCount`
  // lalu diam (Hold) di titik tujuan sampai akhir set.
  const akhirF = Math.min(1, Math.max(0.05, jalanCount / totalCount))
  const dF = Math.min(akhirF * 0.9, Math.max(0, totalTundaCount / totalCount))
  if (pJepit <= dF) return 0
  if (pJepit >= akhirF) return 1
  const lokal = (pJepit - dF) / Math.max(1e-6, akhirF - dF)
  return ease(Math.min(1, Math.max(0, lokal)), mudahEfektif)
}

/**
 * #16 — Jumlah hitungan bergerak efektif yang tersedia bagi seorang pemain,
 * setelah memotong fase *Hold* (`jalanCount`), `tunda` per seksi, serta
 * gelombang `ripple` per pemain.
 *
 * Bila set tidak memakai `jalanCount`, `ripple`, maupun `kelompok`, hasilnya
 * identik 100% dengan rumus lama `counts * (1 - tundaFraksi(g, sectionId, counts))`.
 */
export function countEfektifPemain(
  g: GerakLengkap,
  sectionId: string | undefined,
  counts: number,
  memberId?: string,
): number {
  const totalCount = Math.max(0, counts)
  if (totalCount <= 0) return 0
  const klp = kelompokPemain(g, memberId)
  const rawJalan = klp?.jalanCount ?? g.jalanCount
  const adaHold = typeof rawJalan === 'number' && rawJalan > 0 && rawJalan < totalCount
  const jalanCount = adaHold ? rawJalan : totalCount

  const tundaSeksiCount = sectionId ? Math.max(0, g.tunda[sectionId] ?? 0) : 0
  const gelRipple =
    memberId && g.ripple && typeof g.ripple.urutan?.[memberId] === 'number'
      ? Math.max(0, g.ripple.urutan[memberId])
      : 0
  const tundaRippleCount = g.ripple ? gelRipple * Math.max(0, g.ripple.selangCount || 0) : 0
  const totalTundaCount = tundaSeksiCount + tundaRippleCount

  if (g.ripple?.mode === 'bertahap' && tundaRippleCount > 0) {
    const mulai = Math.min(totalCount * 0.9, totalTundaCount)
    return Math.max(totalCount * 0.1, Math.min(jalanCount, totalCount - mulai))
  }

  const akhirF = Math.min(1, Math.max(0.05, jalanCount / totalCount))
  const dF = Math.min(akhirF * 0.9, Math.max(0, totalTundaCount / totalCount))
  return Math.max(totalCount * 0.05, (akhirF - dF) * totalCount)
}

/** Label siap tampil untuk pilihan pembagian kecepatan. */
export const MUDAH_LABEL: Record<GerakLengkap['mudah'], string> = {
  rata: 'Rata (kecepatan tetap)',
  halus: 'Halus (pelan di awal & akhir)',
  mulaiPelan: 'Mulai pelan, lalu lancar',
  akhirPelan: 'Lancar, lalu melambat',
}

/** Label siap tampil untuk pilihan bentuk jalur. */
export const JALUR_LABEL: Record<GerakLengkap['jalur'], string> = {
  lurus: 'Lurus',
  lengkung: 'Melengkung',
  busur: 'Busur (putar)',
}

/* -------------------------------------------------------------------------- */
/*  Busur putaran — menjaga jarak antar pemain                                */
/* -------------------------------------------------------------------------- */

/**
 * Putar satu titik mengitari `pusat` sebesar `derajat`.
 *
 * Ini lawan dari "jalan lurus ke tujuan". Kalau satu blok diputar, tiap pemain
 * seharusnya mengitari pusat yang sama — bukan memotong lewat tali busur, yang
 * membuat formasi mengkerut di tengah jalan lalu mengembang lagi.
 */
export function putarPosisi(
  x: number,
  y: number,
  pusat: { x: number; y: number },
  derajat: number,
): [number, number] {
  const r = (derajat * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  const dx = x - pusat.x
  const dy = y - pusat.y
  return [pusat.x + dx * cos - dy * sin, pusat.y + dx * sin + dy * cos]
}

/**
 * Titik pada busur pada progres `t` (0..1). Mengembalikan posisi absolut.
 *
 * `geser` membuat **lingkarannya ikut berjalan**: pusat putaran bergeser lurus
 * sejauh `p × geser` selain blok berputar. Secara matematis ini
 *
 *   P(t) = putar(P0, θ·t) + geser·t
 *
 * — dan karena `P(t) − pusat(t) = putar(P0 − pusat, θ·t)`, jarak tiap pemain
 * ke pusat yang *sedang berjalan* itu tetap sama sepanjang jalan. Jadi
 * formasi tidak mengkerut maupun mengembang, hanya ikut terbawa.
 *
 * `geser` nol (bawaan) = berputar di tempat, persis perilaku lama.
 */
export function titikBusur(
  t: number,
  x0: number,
  y0: number,
  pusat: { x: number; y: number },
  sudut: number,
  geser: { x: number; y: number } = { x: 0, y: 0 },
): [number, number] {
  const p = Math.min(1, Math.max(0, t))
  const [x, y] = putarPosisi(x0, y0, pusat, sudut * p)
  return [x + geser.x * p, y + geser.y * p]
}

/** Selisih posisi pada busur — siap dipakai langsung untuk `translate(...)`. */
export function deltaBusur(
  t: number,
  x0: number,
  y0: number,
  pusat: { x: number; y: number },
  sudut: number,
  geser: { x: number; y: number } = { x: 0, y: 0 },
): [number, number] {
  const [x, y] = titikBusur(t, x0, y0, pusat, sudut, geser)
  return [x - x0, y - y0]
}

/**
 * Apakah perpindahan (x0,y0) → (x1,y1) cocok dengan putaran itu?
 *
 * Dipakai supaya busur hanya diberikan pada pemain yang memang ikut berputar;
 * pemain lain tetap memakai jalur lurus/melengkung seperti pengaturannya.
 * Toleransi bawaan 0,5 yard (~18 inci) cukup longgar untuk pembulatan, tapi
 * cukup ketat untuk menolak pemain yang jalannya sama sekali berbeda.
 *
 * `geser` dijumlahkan ke hasil putaran sebelum dibandingkan — jadi pemain yang
 * ikut lingkaran berjalan dicocokkan ke `putar(P0, θ) + geser`.
 */
export function cocokPutaran(
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  pusat: { x: number; y: number },
  sudut: number,
  geser: { x: number; y: number } = { x: 0, y: 0 },
  tol = 0.5,
): boolean {
  if (!sudut) return false
  const [x, y] = putarPosisi(x0, y0, pusat, sudut)
  return Math.hypot(x + geser.x - x1, y + geser.y - y1) <= tol
}

/**
 * Turunkan ke mana pusat putaran berpindah, dari posisi awal & akhir pemain.
 *
 * Ini kebalikan dari `titikBusur`. Untuk tiap pemain, selisih antara
 * "posisi kalau hanya diputar" dan "posisi akhir yang sebenarnya" adalah
 * pergeseran pusatnya:
 *
 *   geser_i = P1 − putar(P0, θ)
 *
 * Semua pemain yang benar-benar ikut berputar menghasilkan `geser` yang sama.
 * Pemain yang tidak ikut (diam, atau jalannya berbeda) menghasilkan angka
 * yang tidak ada hubungannya — karena itu dipakai **kelompok terbesar yang
 * sepakat**, bukan rata-rata semua orang, yang akan tercemar.
 *
 * Mengembalikan `null` kalau tidak ada kelompok yang sepakat ( paling tidak
 * dua pemain ) — satu pemain tidak bisa membuktikan sebuah putaran.
 */
export function turunkanPusatAkhir(
  titik: { x0: number; y0: number; x1: number; y1: number }[],
  pusat: { x: number; y: number },
  sudut: number,
  tol = 0.5,
): { x: number; y: number; ikut: number; dari: number } | null {
  if (!sudut || titik.length < 2) return null

  const geser = titik.map((t) => {
    const [rx, ry] = putarPosisi(t.x0, t.y0, pusat, sudut)
    return { x: t.x1 - rx, y: t.y1 - ry }
  })

  let terbaik = -1
  let anggota: number[] = []
  for (let i = 0; i < geser.length; i++) {
    const grup = geser
      .map((_, j) => j)
      .filter((j) => Math.hypot(geser[j].x - geser[i].x, geser[j].y - geser[i].y) <= tol)
    if (grup.length > anggota.length) {
      anggota = grup
      terbaik = i
    }
  }
  if (terbaik < 0 || anggota.length < 2) return null

  // Rata-rata anggota kelompok, bukan hanya patokannya — supaya pembulatan
  // posisi tidak menumpuk pada satu pemain.
  const sx2 = anggota.reduce((a, j) => a + geser[j].x, 0) / anggota.length
  const sy2 = anggota.reduce((a, j) => a + geser[j].y, 0) / anggota.length
  return { x: pusat.x + sx2, y: pusat.y + sy2, ikut: anggota.length, dari: titik.length }
}

/**
 * Atribut `d` untuk menggambar busur di SVG.
 *
 * Busur disampel jadi garis bersambung (24 segmen), bukan perintah `A`, supaya
 * gambar jejak dan animasi dijamin memakai hitungan yang sama persis.
 */
export function pathBusur(
  x0: number,
  y0: number,
  pusat: { x: number; y: number },
  sudut: number,
  segin = 24,
  geser: { x: number; y: number } = { x: 0, y: 0 },
): string {
  const bagian: string[] = []
  for (let i = 1; i <= segin; i++) {
    const [x, y] = titikBusur(i / segin, x0, y0, pusat, sudut, geser)
    bagian.push(`${i === 1 ? 'M' : 'L'} ${x.toFixed(3)} ${y.toFixed(3)}`)
  }
  return bagian.join(' ')
}

/* -------------------------------------------------------------------------- */
/*  #16 — Follow-the-Leader (FTL), Jalur Sub-Kelompok, & Simbol Visual        */
/* -------------------------------------------------------------------------- */

export interface JalurPoliFtl {
  /** Titik-titik simpul berurutan dalam ruang yang diminta (yard atau SVG) */
  titik: { x: number; y: number }[]
  /** Jarak kumulatif dari titik[0] ke titik[i] */
  kumulatif: number[]
  /** Total panjang lintasan */
  totalPanjang: number
}

/**
 * Bangun lintasan berantai *Follow-the-Leader* (FTL) untuk seluruh anggota
 * sebuah `GerakKelompok` (`jalur === 'ftl'`).
 *
 * Cara kerjanya mengikuti praktik marching band nyata:
 * - Anggota indeks `0` adalah **Pemimpin Barisan (Leader)**: ia berjalan dari
 *   `awal[leader]` langsung ke `akhir[leader]`.
 * - Pengikut ke-`k` (`k >= 1`) mulai dari `awal[k]`, menapak berurutan melewati
 *   jejak rekan di depannya `awal[k-1] -> ... -> awal[0]`, lalu menyusuri jalur
 *   pemimpin menuju titik akhirnya `akhir[k]`.
 * - Dengan parameterisasi panjang busur (`kumulatif`), kecepatan langkah tetap
 *   merata sepanjang jejak ular/rantai dan dijamin tepat berada di `awal[k]`
 *   saat `t = 0` serta `akhir[k]` saat `t = 1`.
 */
export function bangunPetaFtl(
  kelompok: Pick<GerakKelompok, 'memberIds' | 'jalur'>[],
  awal: Record<string, { x: number; y: number }>,
  akhir: Record<string, { x: number; y: number }>,
): Map<string, JalurPoliFtl> {
  const peta = new Map<string, JalurPoliFtl>()
  for (const klp of kelompok) {
    if (klp.jalur !== 'ftl' || klp.memberIds.length < 2) continue
    const aktif = klp.memberIds.filter((id) => awal[id] && akhir[id])
    if (aktif.length < 2) continue

    for (let k = 0; k < aktif.length; k++) {
      const id = aktif[k]
      const simpul: { x: number; y: number }[] = []
      // Susuri titik awal dari pengikut k maju ke pemimpin 0
      for (let j = k; j >= 0; j--) {
        const pt = awal[aktif[j]]
        if (!simpul.length || Math.hypot(pt.x - simpul[simpul.length - 1].x, pt.y - simpul[simpul.length - 1].y) > 1e-5) {
          simpul.push({ x: pt.x, y: pt.y })
        }
      }
      // Lalu menuju titik akhir pemain ini (mengikuti koridor barisan pemimpin)
      const ptAkhir = akhir[id]
      if (!simpul.length || Math.hypot(ptAkhir.x - simpul[simpul.length - 1].x, ptAkhir.y - simpul[simpul.length - 1].y) > 1e-5) {
        simpul.push({ x: ptAkhir.x, y: ptAkhir.y })
      }
      if (simpul.length < 2) continue

      const kumulatif = [0]
      let total = 0
      for (let s = 1; s < simpul.length; s++) {
        total += Math.hypot(simpul[s].x - simpul[s - 1].x, simpul[s].y - simpul[s - 1].y)
        kumulatif.push(total)
      }
      peta.set(id, { titik: simpul, kumulatif, totalPanjang: total })
    }
  }
  return peta
}

/** Hitung perpindahan `[dx, dy]` relatif terhadap `titik[0]` pada progres `t` (0..1). */
export function deltaPoliFtl(poli: JalurPoliFtl, t: number): [number, number] {
  const { titik, kumulatif, totalPanjang } = poli
  if (titik.length < 2 || totalPanjang < 1e-6) return [0, 0]
  const p = Math.min(1, Math.max(0, t))
  if (p <= 0) return [0, 0]
  if (p >= 1) {
    const akhir = titik[titik.length - 1]
    return [akhir.x - titik[0].x, akhir.y - titik[0].y]
  }
  const target = p * totalPanjang
  let seg = 0
  while (seg < kumulatif.length - 2 && kumulatif[seg + 1] < target) {
    seg++
  }
  const d0 = kumulatif[seg]
  const d1 = kumulatif[seg + 1]
  const lokal = d1 > d0 ? (target - d0) / (d1 - d0) : 0
  const x = titik[seg].x + (titik[seg + 1].x - titik[seg].x) * lokal
  const y = titik[seg].y + (titik[seg + 1].y - titik[seg].y) * lokal
  return [x - titik[0].x, y - titik[0].y]
}

/** Atribut `d` SVG `<path>` untuk menggambar lintasan FTL di kanvas lapangan. */
export function pathPoliFtl(poli: JalurPoliFtl): string {
  return poli.titik
    .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(3)} ${pt.y.toFixed(3)}`)
    .join(' ')
}

/** Katalog simbol instruksi visual / tanduk / koreografi (#16.3). */
export const DAFTAR_SIMBOL_VISUAL: {
  id: JenisSimbolVisual
  ikon: string
  kodeCetak: string
  label: string
}[] = [
  { id: 'horn_up', ikon: '🎺↑', kodeCetak: 'HU', label: 'Horn Up' },
  { id: 'horn_down', ikon: '🎺↓', kodeCetak: 'HD', label: 'Horn Down' },
  { id: 'horn_snap', ikon: '⚡', kodeCetak: 'HS', label: 'Horn Snap' },
  { id: 'mark_time', ikon: '👣', kodeCetak: 'MT', label: 'Mark Time' },
  { id: 'halt', ikon: '✋', kodeCetak: 'HALT', label: 'Halt / Berhenti Tegas' },
  { id: 'lunge', ikon: '🦵', kodeCetak: 'LNG', label: 'Lunge' },
  { id: 'hadap_depan', ikon: '👁', kodeCetak: 'FRT', label: 'Hadap Penonton' },
  { id: 'choreo', ikon: '✨', kodeCetak: 'CHR', label: 'Choreo / Body Visual' },
]

export function infoSimbolVisual(id: JenisSimbolVisual) {
  return DAFTAR_SIMBOL_VISUAL.find((s) => s.id === id) ?? DAFTAR_SIMBOL_VISUAL[0]
}

/**
 * Ringkas instruksi koreografi pada sebuah `DrillSet` (Move+Hold, Ripple,
 * FTL/jalur sub-kelompok, dan Simbol Visual) untuk ditampilkan di:
 * - **Dot Sheet & Buku Saku** (hemat ruang, murni teks/hex),
 * - **Mode Anggota** (kartu petunjuk di bawah kanvas formasi),
 * - **DrillPresenter** (bilah status atas saat latihan).
 */
export function ringkasKoreografiSet(
  set: Pick<DrillSet, 'counts' | 'gerak' | 'visual'> | undefined,
  opsi?: { memberId?: string; sectionId?: string; padat?: boolean },
): string[] {
  if (!set) return []
  const butir: string[] = []
  const g = set.gerak
  const klp = kelompokPemain(g, opsi?.memberId)
  const counts = Math.max(0, set.counts || 0)

  // 1. Pembagian Move + Hold
  const jalanCount = klp?.jalanCount ?? g?.jalanCount
  if (counts > 0 && typeof jalanCount === 'number' && jalanCount > 0 && jalanCount < counts) {
    const holdCount = counts - jalanCount
    butir.push(
      opsi?.padat
        ? `Jln ${jalanCount}+Hold ${holdCount}`
        : `Jalan ${jalanCount} + Hold ${holdCount}`,
    )
  }

  // 2. Gelombang Ripple
  if (g?.ripple && g.ripple.selangCount > 0) {
    const memberId = opsi?.memberId
    if (memberId && typeof g.ripple.urutan?.[memberId] === 'number') {
      const gel = g.ripple.urutan[memberId]
      const huruf = labelGelombangRipple(gel)
      const tunda = gel * g.ripple.selangCount
      butir.push(
        opsi?.padat
          ? `Rpl ${huruf}${tunda > 0 ? `(+${tunda})` : ''}`
          : `Ripple ${huruf}${tunda > 0 ? ` (mulai hit. +${tunda})` : ' (gelombang 1)'}`,
      )
    } else if (!memberId && Object.keys(g.ripple.urutan ?? {}).length > 0) {
      butir.push(`Ripple tiap ${g.ripple.selangCount} hit.`)
    }
  }

  // 3. Jalur sub-kelompok / Follow-the-Leader (FTL)
  if (klp) {
    if (klp.jalur === 'ftl') {
      const urutan = klp.memberIds.indexOf(opsi?.memberId ?? '')
      butir.push(
        opsi?.padat
          ? `FTL#${urutan + 1}`
          : urutan === 0
            ? `FTL (${klp.nama} · Pemimpin)`
            : `FTL (${klp.nama} · urut #${urutan + 1})`,
      )
    } else if (!opsi?.padat) {
      butir.push(`Kelompok ${klp.nama}: ${klp.jalur === 'lengkung' ? 'Melengkung' : 'Lurus'}`)
    }
  } else if (!opsi?.memberId && g?.kelompok?.some((k) => k.jalur === 'ftl')) {
    const jmlFtl = g.kelompok.filter((k) => k.jalur === 'ftl').length
    butir.push(`FTL (${jmlFtl} barisan)`)
  }

  // 4. Simbol Visual / Tanduk / Koreografi
  const vis = set.visual
  if (vis && (vis.simbol?.length || vis.catatan?.trim())) {
    const berlaku =
      !vis.seksi?.length || !opsi?.sectionId || vis.seksi.includes(opsi.sectionId)
    if (berlaku) {
      for (const sId of vis.simbol ?? []) {
        const info = infoSimbolVisual(sId)
        butir.push(opsi?.padat ? `[${info.kodeCetak}] ${info.label}` : `${info.ikon} ${info.label}`)
      }
      if (vis.catatan?.trim()) {
        butir.push(vis.catatan.trim())
      }
    }
  }

  return butir
}
