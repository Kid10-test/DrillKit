import type { GerakSet } from '../db/types'

/**
 * DD2 — Jalur & pembagian gerak antar set.
 *
 * Modul ini sengaja terpisah supaya **editor**, **presenter**, dan **gambar
 * jejak** memakai hitungan yang sama persis — kalau salah satu diubah, semuanya
 * ikut. (Pelajaran dari DD1: dua hitungan terpisah pernah membuat koordinat
 * dan gambar patok tidak sejalan.)
 *
 * Sejarah singkat: sebelum DD2, animasi cuma `translate(vx * p, vy * p)` —
 * pemain meluncur lurus dengan kecepatan konstan dari awal sampai akhir.
 */

/**
 * Pengaturan gerak yang sudah dilengkapi nilai bawaan.
 * `putar` sengaja tetap opsional — tidak ada putaran kalau tidak diatur.
 */
export type GerakLengkap = Required<Omit<GerakSet, 'putar'>> & { putar?: GerakSet['putar'] }

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

/**
 * Progres gerak **pemain ini** pada progres waktu set `p` (0..1).
 *
 * Section yang ditunda tetap diam sampai tundanya habis, lalu bergerak lebih
 * cepat dan **tiba bersamaan** dengan yang lain di akhir — itulah yang
 * diharapkan pada "mulai bertahap" di lapangan.
 */
export function progresPemain(
  p: number,
  g: GerakLengkap,
  sectionId: string | undefined,
  counts: number,
): number {
  const d = tundaFraksi(g, sectionId, counts)
  if (d <= 0) return ease(p, g.mudah)
  const lokal = (p - d) / (1 - d)
  return ease(Math.min(1, Math.max(0, lokal)), g.mudah)
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
