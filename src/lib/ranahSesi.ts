/**
 * #35 — isi sesi per ranah, blok paralel per seksi, pola sesi, dan neraca
 * mingguan.
 *
 * Keluhan yang mendasarinya (Latsar Cab 42): *"pembagian sesinya apa saja —
 * drill, section, atau fisik?"* Selama ini satu sesi hanya punya **satu**
 * jenis (latihan/section/gabungan), padahal sesi nyata selalu campuran.
 * Modul ini menjawabnya dari rencana blok yang sudah ada:
 *
 * 1. **Ranah per blok** — `BlokLatihan.jenis` kini sekaligus ranah. Label
 *    sesi ("Fisik + Visual") diturunkan dari isinya, bukan dipilih tangan.
 * 2. **Blok paralel** — di jam yang sama Brass, Perkusi, dan CG punya
 *    kegiatan sendiri. Seksi yang tidak kebagian kegiatan dihitung
 *    *menganggur* (non-materi) dan diberi peringatan.
 * 3. **Neraca mingguan** — menit per ranah per seksi dibandingkan target
 *    proporsi, sehingga "minggu ini kebanyakan fisik, section kurang"
 *    terlihat sebelum lapangan, bukan sesudahnya.
 * 4. **Pola sesi** — Pola A/B/C yang bisa diterapkan ke banyak sesi sekaligus.
 *
 * Sengaja **murni** (tanpa Dexie, React, atau DOM) supaya diuji dari node.
 */
import type { BlokLatihan, CabangBlok, JenisBlok, PolaSesi, Session, SessionType, TargetNeraca } from '../db/types'

/* ------------------------------- ranah ------------------------------- */

export type RanahNeraca = 'fisik' | 'visual' | 'musik' | 'section' | 'drill' | 'gabungan' | 'teori' | 'nonmateri'
export type RanahMateri = Exclude<RanahNeraca, 'nonmateri'>

export const URUTAN_RANAH: RanahNeraca[] = ['fisik', 'visual', 'musik', 'section', 'drill', 'gabungan', 'teori', 'nonmateri']
export const RANAH_MATERI: RanahMateri[] = ['fisik', 'visual', 'musik', 'section', 'drill', 'gabungan', 'teori']

export const LABEL_RANAH: Record<RanahNeraca, string> = {
  fisik: 'Fisik',
  visual: 'Visual',
  musik: 'Musik bersama',
  section: 'Section',
  drill: 'Drill/formasi',
  gabungan: 'Gabungan',
  teori: 'Teori & tes',
  nonmateri: 'Non-materi',
}

/** Singkatan untuk kolom sempit (cetak & HP). */
export const SINGKAT_RANAH: Record<RanahNeraca, string> = {
  fisik: 'Fis',
  visual: 'Vis',
  musik: 'Mus',
  section: 'Sec',
  drill: 'Drl',
  gabungan: 'Gab',
  teori: 'Teo',
  nonmateri: 'Non',
}

/**
 * Warna hex per ranah — dipakai layar (gaya inline) **dan** cetak, jadi
 * tidak ada oklch/color-mix. Nada tengah supaya terbaca di latar gelap
 * maupun kertas putih.
 */
export const WARNA_RANAH_HEX: Record<RanahNeraca, string> = {
  fisik: '#f97316',
  visual: '#22c55e',
  musik: '#3b82f6',
  section: '#06b6d4',
  drill: '#a855f7',
  gabungan: '#ec4899',
  teori: '#eab308',
  nonmateri: '#64748b',
}

/**
 * Kelompok neraca untuk tiap jenis blok. Pemanasan & pendinginan dihitung
 * fisik (beban tubuh), apel/istirahat/lainnya non-materi, tes ikut teori.
 */
export function ranahDariJenis(j: JenisBlok | string | undefined): RanahNeraca {
  switch (j) {
    case 'pemanasan':
    case 'fisik':
    case 'pendingin':
      return 'fisik'
    case 'visual':
      return 'visual'
    case 'musik':
      return 'musik'
    case 'section':
      return 'section'
    case 'drill':
      return 'drill'
    case 'gabungan':
      return 'gabungan'
    case 'teori':
    case 'tes':
      return 'teori'
    default:
      return 'nonmateri'
  }
}

export type Menit = Record<RanahNeraca, number>

export function menitKosong(): Menit {
  return { fisik: 0, visual: 0, musik: 0, section: 0, drill: 0, gabungan: 0, teori: 0, nonmateri: 0 }
}

const durasi = (b: BlokLatihan) => (Number.isFinite(b.menit) && b.menit > 0 ? b.menit : 0)

/** Seksi pengganti saat tim belum punya daftar seksi aktif. */
export const SEKSI_TUNGGAL = '*'

/* ----------------------------- komposisi ----------------------------- */

export interface KomposisiSesi {
  /** Menit per ranah untuk tiap seksi aktif. */
  perSeksi: Record<string, Menit>
  /** Rata-rata seluruh seksi aktif — "yang dialami satu anak rata-rata". */
  rataRata: Menit
  adaParalel: boolean
  /** Total menit rencana (blok sah). */
  total: number
}

/**
 * Menit per ranah per seksi untuk satu rencana.
 *
 * - Blok bersama: semua seksi mendapat menitnya.
 * - Blok paralel: tiap seksi mendapat menit menurut jalurnya; seksi yang
 *   muncul di dua jalur hanya dihitung di jalur pertama; seksi yang tidak
 *   punya jalur dihitung **non-materi** (menganggur).
 */
export function komposisiRencana(blok: BlokLatihan[] | undefined, seksi: string[]): KomposisiSesi {
  const daftar = seksi.length ? [...new Set(seksi)] : [SEKSI_TUNGGAL]
  const perSeksi: Record<string, Menit> = {}
  for (const id of daftar) perSeksi[id] = menitKosong()
  let adaParalel = false
  let total = 0
  for (const b of blok ?? []) {
    const m = durasi(b)
    if (!m) continue
    total += m
    const cabang = b.cabang?.filter(Boolean) ?? []
    if (cabang.length === 0 || daftar[0] === SEKSI_TUNGGAL) {
      const r = ranahDariJenis(b.jenis)
      for (const id of daftar) perSeksi[id][r] += m
      if (cabang.length) adaParalel = true
      continue
    }
    adaParalel = true
    const sudah = new Set<string>()
    for (const c of cabang) {
      const r = ranahDariJenis(c.jenis ?? b.jenis)
      for (const id of c.seksi ?? []) {
        if (!perSeksi[id] || sudah.has(id)) continue
        sudah.add(id)
        perSeksi[id][r] += m
      }
    }
    for (const id of daftar) if (!sudah.has(id)) perSeksi[id].nonmateri += m
  }
  return { perSeksi, rataRata: rataRataMenit(Object.values(perSeksi)), adaParalel, total }
}

export function rataRataMenit(daftar: Menit[]): Menit {
  const hasil = menitKosong()
  if (!daftar.length) return hasil
  for (const m of daftar) for (const r of URUTAN_RANAH) hasil[r] += m[r]
  for (const r of URUTAN_RANAH) hasil[r] = Math.round((hasil[r] / daftar.length) * 10) / 10
  return hasil
}

export function jumlahMateri(m: Menit): number {
  return RANAH_MATERI.reduce((t, r) => t + m[r], 0)
}

export function jumlahSemua(m: Menit): number {
  return URUTAN_RANAH.reduce((t, r) => t + m[r], 0)
}

/** Persen tiap ranah materi terhadap total materi (dibulatkan). */
export function persenMateri(m: Menit): Record<RanahMateri, number> {
  const tot = jumlahMateri(m)
  const hasil = {} as Record<RanahMateri, number>
  for (const r of RANAH_MATERI) hasil[r] = tot > 0 ? Math.round((m[r] / tot) * 100) : 0
  return hasil
}

/**
 * Label sesi dari isinya, mis. "Fisik + Visual + Musik bersama". Ranah
 * yang porsinya < 15% materi tidak disebut (paling banyak tiga), urutannya
 * mengikuti urutan baku supaya label sesi yang mirip tampak sama.
 */
export function labelKomposisi(m: Menit): string {
  const tot = jumlahMateri(m)
  if (tot <= 0) return jumlahSemua(m) > 0 ? 'Tanpa materi' : ''
  const besar = RANAH_MATERI.filter((r) => m[r] / tot >= 0.15)
    .sort((a, b) => m[b] - m[a])
    .slice(0, 3)
  const pilih = besar.length ? besar : [RANAH_MATERI.reduce((a, b) => (m[b] > m[a] ? b : a))]
  return RANAH_MATERI.filter((r) => pilih.includes(r))
    .map((r) => LABEL_RANAH[r])
    .join(' + ')
}

/** Rata-rata per seksi bisa pecahan (16,7′); di lapangan cukup menit bulat. */
const bulat = (n: number) => String(Math.round(n))

/** "Fisik 35′ · Visual 45′ · Non-materi 10′" — ranah bermenit nol dilewati. */
export function teksKomposisi(m: Menit): string {
  return URUTAN_RANAH.filter((r) => m[r] > 0)
    .map((r) => `${LABEL_RANAH[r]} ${bulat(m[r])}′`)
    .join(' · ')
}

/* ----------------------------- pemeriksaan ----------------------------- */

export type KodePeringatan =
  | 'seksi-kosong'
  | 'seksi-ganda'
  | 'cabang-tanpa-seksi'
  | 'pelatih-ganda'
  | 'tempat-ganda'
  | 'tanpa-rencana'
  | 'lebih-slot'

export interface Peringatan {
  kode: KodePeringatan
  /** `info` = boleh jadi memang disengaja (mis. lapangan dibagi dua). */
  tingkat: 'peringatan' | 'info'
  teks: string
  blokId?: string
}

/** Pecah "Kak Dimas, Kak Rani & Bu Sari" menjadi nama-nama ternormalisasi. */
export function namaPelatih(teks: string | undefined): string[] {
  if (!teks) return []
  return teks
    .split(/\s*(?:,|&|\/|\+|;|\bdan\b)\s*/i)
    .map((x) => x.trim().replace(/\s+/g, ' ').toLowerCase())
    .filter(Boolean)
}

const daftarLabel = (ids: string[], label: (id: string) => string) => {
  const nama = ids.map(label)
  if (nama.length <= 1) return nama.join('')
  return `${nama.slice(0, -1).join(', ')} dan ${nama[nama.length - 1]}`
}

/**
 * Periksa rencana satu sesi: seksi tanpa kegiatan di blok paralel, seksi di
 * dua jalur sekaligus, pelatih yang dijadwalkan di dua tempat pada jam yang
 * sama, dan tempat yang dipakai dua jalur (info).
 */
export function periksaRencana(
  blok: BlokLatihan[] | undefined,
  seksi: string[],
  label: (id: string) => string = (id) => id,
): Peringatan[] {
  const hasil: Peringatan[] = []
  for (const b of blok ?? []) {
    const cabang: CabangBlok[] = b.cabang?.filter(Boolean) ?? []
    if (!cabang.length) continue
    const judul = b.judul || 'tanpa judul'
    const dipakai = new Map<string, number>()
    for (const c of cabang) {
      if (!c.seksi?.length) {
        hasil.push({
          kode: 'cabang-tanpa-seksi',
          tingkat: 'peringatan',
          teks: `Jalur “${c.judul || 'tanpa judul'}” di blok “${judul}” belum diberi seksi.`,
          blokId: b.id,
        })
      }
      for (const id of new Set(c.seksi ?? [])) dipakai.set(id, (dipakai.get(id) ?? 0) + 1)
    }
    const kosong = seksi.filter((id) => !dipakai.has(id))
    if (kosong.length && seksi.length) {
      hasil.push({
        kode: 'seksi-kosong',
        tingkat: 'peringatan',
        teks: `${daftarLabel(kosong, label)} tidak punya kegiatan di blok “${judul}”.`,
        blokId: b.id,
      })
    }
    const ganda = [...dipakai.entries()].filter(([, n]) => n > 1).map(([id]) => id)
    if (ganda.length) {
      hasil.push({
        kode: 'seksi-ganda',
        tingkat: 'peringatan',
        teks: `${daftarLabel(ganda, label)} masuk dua jalur sekaligus di blok “${judul}”.`,
        blokId: b.id,
      })
    }
    const pelatih = new Map<string, { asli: string; n: number }>()
    for (const c of cabang) {
      const asli = (c.pelatih ?? '').split(/\s*(?:,|&|\/|\+|;|\bdan\b)\s*/i).map((x) => x.trim()).filter(Boolean)
      namaPelatih(c.pelatih).forEach((k, i) => {
        const ada = pelatih.get(k)
        pelatih.set(k, { asli: ada?.asli ?? asli[i] ?? k, n: (ada?.n ?? 0) + 1 })
      })
    }
    for (const { asli, n } of pelatih.values()) {
      if (n > 1) {
        hasil.push({
          kode: 'pelatih-ganda',
          tingkat: 'peringatan',
          teks: `${asli} dijadwalkan di ${n} jalur sekaligus pada blok “${judul}”.`,
          blokId: b.id,
        })
      }
    }
    const tempat = new Map<string, { asli: string; n: number }>()
    for (const c of cabang) {
      const t = (c.tempat ?? '').trim()
      if (!t) continue
      const k = t.toLowerCase().replace(/\s+/g, ' ')
      const ada = tempat.get(k)
      tempat.set(k, { asli: ada?.asli ?? t, n: (ada?.n ?? 0) + 1 })
    }
    for (const { asli, n } of tempat.values()) {
      if (n > 1) {
        hasil.push({
          kode: 'tempat-ganda',
          tingkat: 'info',
          teks: `${asli} dipakai ${n} jalur bersamaan di blok “${judul}” — pastikan cukup luas.`,
          blokId: b.id,
        })
      }
    }
  }
  return hasil
}

/* ------------------------------- neraca ------------------------------- */

export interface BarisNeraca {
  seksi: string
  menit: Menit
  materi: number
  total: number
  persen: Record<RanahMateri, number>
}

export interface SelisihTarget {
  seksi: string[]
  ranah: RanahMateri
  persen: number
  target: number
  beda: number
}

export interface SesiNeraca {
  id: string
  judul: string
  tanggal: string
  jam: string
  adaRencana: boolean
  adaParalel: boolean
  menit: Menit
  label: string
}

export interface PeringatanSesi extends Peringatan {
  sesiId: string
  tanggal: string
  judulSesi: string
}

export interface HasilNeraca {
  sesi: SesiNeraca[]
  perSeksi: BarisNeraca[]
  rataRata: BarisNeraca
  selisih: SelisihTarget[]
  peringatan: PeringatanSesi[]
}

/** Jenis kegiatan yang seharusnya punya rencana latihan. */
export const JENIS_BERENCANA: SessionType[] = ['latihan', 'section', 'gabungan']

function menitJam(jam: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((jam ?? '').trim())
  if (!m) return null
  const h = Number(m[1])
  const n = Number(m[2])
  return h > 23 || n > 59 ? null : h * 60 + n
}

const baris = (seksi: string, menit: Menit): BarisNeraca => ({
  seksi,
  menit,
  materi: jumlahMateri(menit),
  total: jumlahSemua(menit),
  persen: persenMateri(menit),
})

/**
 * Neraca sekumpulan sesi (biasanya satu minggu Senin–Minggu).
 *
 * Yang dihitung adalah **rencana**, jadi minggu yang belum berjalan pun
 * punya neraca — itulah gunanya: memperbaiki komposisi sebelum lapangan.
 */
export function neracaSesi(
  sesi: Session[],
  seksi: string[],
  opsi: { target?: TargetNeraca | null; label?: (id: string) => string; ambangBeda?: number } = {},
): HasilNeraca {
  const label = opsi.label ?? ((id: string) => id)
  const ambang = opsi.ambangBeda ?? 10
  const daftar = seksi.length ? [...new Set(seksi)] : [SEKSI_TUNGGAL]
  const jumlah: Record<string, Menit> = {}
  for (const id of daftar) jumlah[id] = menitKosong()
  const hasilSesi: SesiNeraca[] = []
  const peringatan: PeringatanSesi[] = []
  const urut = [...sesi].sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))
  for (const s of urut) {
    const blok = s.rencanaLatihan ?? []
    const ada = blok.some((b) => durasi(b) > 0)
    if (!ada && !JENIS_BERENCANA.includes(s.type)) continue
    const k = komposisiRencana(blok, seksi)
    for (const id of daftar) for (const r of URUTAN_RANAH) jumlah[id][r] += k.perSeksi[id][r]
    hasilSesi.push({
      id: s.id,
      judul: s.title,
      tanggal: s.date,
      jam: `${s.startTime}–${s.endTime}`,
      adaRencana: ada,
      adaParalel: k.adaParalel,
      menit: k.rataRata,
      label: labelKomposisi(k.rataRata),
    })
    const tambah = (p: Peringatan) => peringatan.push({ ...p, sesiId: s.id, tanggal: s.date, judulSesi: s.title })
    if (!ada) {
      tambah({ kode: 'tanpa-rencana', tingkat: 'peringatan', teks: `“${s.title}” belum punya rencana isi sesi.` })
      continue
    }
    const a = menitJam(s.startTime)
    const z = menitJam(s.endTime)
    if (a != null && z != null && z > a && k.total > z - a) {
      tambah({
        kode: 'lebih-slot',
        tingkat: 'peringatan',
        teks: `“${s.title}”: rencana ${k.total} menit, slotnya ${z - a} menit.`,
      })
    }
    for (const p of periksaRencana(blok, seksi, label)) tambah(p)
  }
  const perSeksi = daftar.map((id) => baris(id, jumlah[id]))
  const rataRata = baris('rata-rata', rataRataMenit(perSeksi.map((b) => b.menit)))
  const selisih: SelisihTarget[] = []
  const target = opsi.target?.persen
  if (target && Object.values(target).some((v) => (v ?? 0) > 0)) {
    const kelompok = new Map<string, SelisihTarget>()
    for (const b of perSeksi) {
      if (b.materi <= 0) continue
      for (const r of RANAH_MATERI) {
        const t = target[r] ?? 0
        const beda = b.persen[r] - t
        if (Math.abs(beda) < ambang) continue
        const kunci = `${r}|${b.persen[r]}|${t}`
        const ada = kelompok.get(kunci)
        if (ada) ada.seksi.push(b.seksi)
        else kelompok.set(kunci, { seksi: [b.seksi], ranah: r, persen: b.persen[r], target: t, beda })
      }
    }
    selisih.push(...[...kelompok.values()].sort((x, y) => Math.abs(y.beda) - Math.abs(x.beda)))
  }
  return { sesi: hasilSesi, perSeksi, rataRata, selisih, peringatan }
}

/** Kalimat selisih target, mis. "Brass dan CG: Fisik 45% (target 30%, +15)". */
export function teksSelisih(s: SelisihTarget, label: (id: string) => string = (id) => id, semuaSeksi = 0): string {
  const siapa = semuaSeksi > 1 && s.seksi.length === semuaSeksi ? 'Semua seksi' : daftarLabel(s.seksi, label)
  const tanda = s.beda > 0 ? `+${s.beda}` : String(s.beda)
  return `${siapa}: ${LABEL_RANAH[s.ranah]} ${s.persen}% (target ${s.target}%, ${tanda})`
}

/** Target bawaan per fase program. Bisa diubah tim. */
export const PRESET_TARGET: TargetNeraca[] = [
  { nama: 'Dasar bersama', persen: { fisik: 30, visual: 35, musik: 35 } },
  { nama: 'Teknik per seksi', persen: { fisik: 20, visual: 30, section: 45, drill: 5 } },
  { nama: 'Menjelang tampil', persen: { fisik: 15, visual: 15, section: 25, drill: 20, gabungan: 25 } },
]

export function jumlahTarget(t: TargetNeraca | null | undefined): number {
  if (!t) return 0
  return RANAH_MATERI.reduce((n, r) => n + (t.persen[r] ?? 0), 0)
}

/* ------------------------------- pola ------------------------------- */

/** Salin rencana dengan id baru untuk tiap blok & jalur (aman ditempel ke sesi lain). */
export function salinRencana(blok: BlokLatihan[] | undefined, buatId: (awalan: string) => string): BlokLatihan[] {
  return (blok ?? []).map((b) => {
    const salin: BlokLatihan = JSON.parse(JSON.stringify(b))
    salin.id = buatId('b_')
    if (salin.cabang) salin.cabang = salin.cabang.map((c) => ({ ...c, seksi: [...(c.seksi ?? [])], id: buatId('j_') }))
    return salin
  })
}

export function buatPola(nama: string, blok: BlokLatihan[], buatId: (awalan: string) => string, sekarang = Date.now()): PolaSesi {
  return { id: buatId('pola_'), nama: nama.trim(), rencana: salinRencana(blok, buatId), dibuat: sekarang }
}

/** Simpan pola ke pustaka; nama yang sama (tanpa beda besar-kecil huruf) ditimpa. */
export function simpanPola(daftar: PolaSesi[] | undefined, pola: PolaSesi): { daftar: PolaSesi[]; ditimpa: boolean } {
  const kunci = pola.nama.trim().toLowerCase()
  const lama = daftar ?? []
  const i = lama.findIndex((p) => p.nama.trim().toLowerCase() === kunci)
  if (i < 0) return { daftar: [...lama, pola], ditimpa: false }
  const baru = [...lama]
  baru[i] = { ...pola, id: lama[i].id }
  return { daftar: baru, ditimpa: true }
}

export interface AturanTerapPola {
  dari: string
  sampai: string
  /** Hari dalam minggu, 0 = Senin … 6 = Minggu. Kosong = semua hari. */
  hari: number[]
  /** Jenis kegiatan yang boleh diisi. Kosong = semua jenis. */
  jenis: SessionType[]
  /** `ganti` menimpa rencana yang ada; `kosong` hanya mengisi sesi tanpa rencana. */
  mode: 'ganti' | 'kosong'
}

export interface RencanaTerapPola {
  isi: Session[]
  dilewati: { sesi: Session; alasan: 'sudah-berjalan' | 'sudah-ada-rencana' }[]
}

export function hariSeninDari(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return (new Date(y, (m || 1) - 1, d || 1).getDay() + 6) % 7
}

/**
 * Rencanakan penerapan pola ke banyak sesi. Sesi yang sudah punya catatan
 * realisasi **tidak pernah** ditimpa — riwayat latihan nyata lebih berharga
 * daripada rencana baru.
 */
export function rencanakanTerapPola(
  semua: Session[],
  pola: PolaSesi,
  aturan: AturanTerapPola,
  buatId: (awalan: string) => string,
): RencanaTerapPola {
  const hari = new Set(aturan.hari)
  const jenis = new Set(aturan.jenis)
  const isi: Session[] = []
  const dilewati: RencanaTerapPola['dilewati'] = []
  const urut = [...semua].sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))
  for (const s of urut) {
    if (s.date < aturan.dari || s.date > aturan.sampai) continue
    if (hari.size && !hari.has(hariSeninDari(s.date))) continue
    if (jenis.size && !jenis.has(s.type)) continue
    if ((s.realisasiLatihan?.length ?? 0) > 0 || s.mulaiNyata) {
      dilewati.push({ sesi: s, alasan: 'sudah-berjalan' })
      continue
    }
    if (aturan.mode === 'kosong' && (s.rencanaLatihan?.length ?? 0) > 0) {
      dilewati.push({ sesi: s, alasan: 'sudah-ada-rencana' })
      continue
    }
    isi.push({ ...s, rencanaLatihan: salinRencana(pola.rencana, buatId) })
  }
  return { isi, dilewati }
}

/* --------------------------- contoh pola Latsar --------------------------- */

export interface InfoSeksi {
  id: string
  label: string
}

function materiSeksi(s: InfoSeksi, campuran: boolean): string {
  const t = `${s.id} ${s.label}`.toLowerCase()
  if (/brass|terompet|trumpet|mellophone|baritone|tuba|horn/.test(t)) return campuran ? 'Lip slur & tangga nada' : 'Long tone & pernapasan alat'
  if (/perkusi|percussion|battery|drum|snare|tenor|bass|pit|marimba/.test(t))
    return campuran ? 'Accent-tap & double beat' : 'Grip, tinggi pukulan & 8-on-a-hand'
  if (/guard|\bcg\b|bendera|flag|rifle|sabre/.test(t)) return campuran ? 'Rangkaian bendera dasar' : 'Dasar bendera: drop spin & carving'
  return campuran ? 'Teknik dasar seksi (lanjutan)' : 'Teknik dasar seksi'
}

/**
 * Tiga pola contoh untuk sesi 120 menit program latihan dasar. Blok
 * section dibuat paralel untuk seksi aktif tim; judul & menit bebas diubah.
 */
export function polaContohLatsar(seksi: InfoSeksi[], buatId: (awalan: string) => string, sekarang = Date.now()): PolaSesi[] {
  const blok = (judul: string, jenis: JenisBlok, menit: number, cabang?: CabangBlok[]): BlokLatihan => ({
    id: buatId('b_'),
    judul,
    jenis,
    menit,
    ...(cabang ? { cabang } : {}),
  })
  const paralel = (campuran: boolean): CabangBlok[] | undefined =>
    seksi.length > 1
      ? seksi.map((s) => ({ id: buatId('j_'), seksi: [s.id], judul: materiSeksi(s, campuran), jenis: 'section' as JenisBlok }))
      : undefined
  return [
    {
      id: buatId('pola_'),
      nama: 'Latsar A — Fisik + Visual',
      dibuat: sekarang,
      rencana: [
        blok('Apel & absensi', 'apel', 10),
        blok('Pemanasan & peregangan', 'pemanasan', 15),
        blok('Kardio & core', 'fisik', 25),
        blok('Sikap, mark time, langkah 8-to-5', 'visual', 45),
        blok('Minum', 'istirahat', 5),
        blok('Hitungan & istilah lapangan', 'teori', 10),
        blok('Pendinginan & evaluasi', 'pendingin', 10),
      ],
    },
    {
      id: buatId('pola_'),
      nama: 'Latsar B — Musik + Section',
      dibuat: sekarang,
      rencana: [
        blok('Apel & absensi', 'apel', 10),
        blok('Pemanasan', 'pemanasan', 10),
        blok('Ritme, tepuk hitungan & pernapasan', 'musik', 30),
        blok('Minum', 'istirahat', 5),
        blok('Section per seksi', 'section', 50, paralel(false)),
        blok('Pendinginan & evaluasi', 'pendingin', 15),
      ],
    },
    {
      id: buatId('pola_'),
      nama: 'Latsar C — Campuran',
      dibuat: sekarang,
      rencana: [
        blok('Apel & absensi', 'apel', 10),
        blok('Pemanasan + fisik ringan', 'pemanasan', 15),
        blok('Ulang visual dasar', 'visual', 30),
        blok('Minum', 'istirahat', 5),
        blok('Section per seksi', 'section', 35, paralel(true)),
        blok('Gabungan sederhana / tes kecil', 'gabungan', 15),
        blok('Pendinginan & evaluasi', 'pendingin', 10),
      ],
    },
  ]
}
