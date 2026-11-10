/**
 * v2.7.1 — Roster anggota yang jelas di pergantian musim.
 *
 * Tiga kebutuhan, satu sumber kebenaran (`Member.tags` + `Member.active`):
 *  1. **Impor CSV yang mencocokkan nama** — anggota yang sudah ada diperbarui
 *     (bukan digandakan); sel kosong tidak menghapus data lama; tag digabung.
 *  2. **Aksi massal** — tambah/lepas tag & aktifkan/nonaktifkan banyak
 *     anggota sekaligus (mis. returner yang sudah berkomitmen).
 *  3. **Rekap roster** — jumlah per section × instrumen untuk tiap kelompok
 *     roster (tag), supaya celah instrumen terlihat.
 *
 * Tidak ada tabel/field anggota baru: "kelompok roster" hanyalah tag yang
 * dipilih pelatih (`TeamSettings.kelompokRoster`). Murni — diuji di node.
 */
import type { Member, MemberRole } from '../db/types'
import { type BarisCsvAnggota, type KolomCsvAnggota, kemiripanNama, norm } from './namaAnggota'
import { bersihkanSatuTag, lepasTagDariAnggota, normalisasiDaftarTag, pasangTagKeAnggota, punyaTag } from './tagAnggota'

/* ---------------------------------- Pemisah ---------------------------------- */

/**
 * Tebak pemisah kolom dari baris judul. Excel berbahasa Indonesia menyimpan
 * CSV dengan `;`, sehingga koma di dalam sel (mis. kolom Tag "CAB 42, Latsar")
 * tidak dikutip — kalau koma tetap dianggap pemisah, kolomnya bergeser.
 */
export function tebakPemisahCsv(judul: string): ',' | ';' | '\t' | undefined {
  let koma = 0
  let titikKoma = 0
  let tab = 0
  let kutip = false
  for (const ch of judul) {
    if (ch === '"') kutip = !kutip
    else if (!kutip) {
      if (ch === ',') koma++
      else if (ch === ';') titikKoma++
      else if (ch === '\t') tab++
    }
  }
  if (tab > koma && tab > titikKoma) return '\t'
  if (titikKoma > 0 && koma === 0) return ';'
  if (koma > 0 && titikKoma === 0) return ','
  return undefined
}


/* ------------------------------ Kelompok roster ------------------------------ */

/** Kelompok bawaan bila pelatih belum memilih — pola pergantian musim. */
export function kelompokRosterBawaan(tahun: number): string[] {
  return ['CAB', `Returner ${tahun + 1}`, 'Returner – menunggu', 'Alumni']
}

/** Tag yang lazim dipakai sebagai kelompok roster (bukan tag formasi seperti "Solois"). */
const POLA_KELOMPOK = /^(cab|calon|returner|alumni|angkatan|latsar|anggota baru|senior|junior)\b/i

/**
 * Kelompok roster yang dipakai: pilihan tersimpan, atau — bila belum pernah
 * disimpan — tebakan dari tag anggota yang mirip kelompok (urut terbanyak).
 */
export function kelompokRosterAktif(
  tersimpan: readonly string[] | undefined,
  anggota: readonly Pick<Member, 'tags'>[],
): string[] {
  // Pilihan tersimpan (termasuk daftar kosong) selalu menang atas tebakan.
  if (tersimpan) return normalisasiDaftarTag(tersimpan)
  const hitung = new Map<string, { tag: string; n: number }>()
  for (const m of anggota) {
    for (const t of m.tags ?? []) {
      const tag = bersihkanSatuTag(t)
      if (!POLA_KELOMPOK.test(tag)) continue
      const k = tag.toLowerCase()
      const e = hitung.get(k) ?? { tag, n: 0 }
      e.n += 1
      hitung.set(k, e)
    }
  }
  return [...hitung.values()].sort((a, b) => b.n - a.n || a.tag.localeCompare(b.tag)).map((e) => e.tag)
}

/** Kelompok roster pertama yang dipegang anggota (urutan kelompok = prioritas). */
export function kelompokAnggota(m: Pick<Member, 'tags'>, kelompok: readonly string[]): number {
  for (let i = 0; i < kelompok.length; i++) if (punyaTag(m, kelompok[i])) return i
  return -1
}

/* --------------------------------- Impor CSV --------------------------------- */

export type JenisBarisImpor = 'baru' | 'perbarui' | 'sama' | 'mirip'

export interface KandidatCocok {
  id: string
  skor: number
}

export interface BarisRencanaImpor {
  /** Urutan baris data di berkas (0 = baris pertama setelah judul). */
  indeks: number
  baris: BarisCsvAnggota
  jenis: JenisBarisImpor
  /** Anggota lokal yang dicocokkan (perbarui/sama), atau kandidat terbaik (mirip). */
  idLokal?: string
  /** `mirip`: calon pasangan, skor menurun. */
  kandidat?: KandidatCocok[]
  /** Ringkasan perubahan bila diterapkan ke `idLokal`. */
  perubahan: string[]
  /** Nama yang sama muncul lebih dari sekali di berkas ini. */
  gandaDiBerkas?: boolean
}

export interface RencanaImpor {
  baris: BarisRencanaImpor[]
  jumlah: Record<JenisBarisImpor, number>
}

/** Batas kemiripan untuk menanyakan "orang yang sama?" (nama beda ejaan/singkat). */
export const AMBANG_MIRIP = 0.85

function miripOrang(a: { name?: string; panggilan?: string }, b: { name?: string; panggilan?: string }): number {
  return Math.max(
    kemiripanNama(a.name, b.name),
    kemiripanNama(a.name, b.panggilan),
    kemiripanNama(a.panggilan, b.name),
  )
}

type LabelPeran = (r: MemberRole) => string
type LabelSection = (id: string) => string

/**
 * Terapkan satu baris CSV ke anggota lama. Hanya kolom yang terisi yang
 * menimpa; tag selalu **digabung** (tidak pernah dilepas lewat impor).
 */
export function terapkanBarisKeAnggota(
  lokal: Member,
  b: BarisCsvAnggota,
  label: { section?: LabelSection; peran?: LabelPeran } = {},
): { hasil: Member; perubahan: string[] } {
  const hasil: Member = { ...lokal }
  const perubahan: string[] = []
  const isi = new Set<KolomCsvAnggota>(b.terisi)
  const ls = label.section ?? ((x: string) => x)
  const lp = label.peran ?? ((x: string) => x)
  const ganti = <K extends keyof Member>(k: K, v: Member[K], teks: string) => {
    if ((hasil[k] ?? '') === (v ?? '')) return
    hasil[k] = v
    perubahan.push(teks)
  }
  if (isi.has('panggilan') && b.panggilan) ganti('panggilan', b.panggilan, `panggilan → ${b.panggilan}`)
  if (isi.has('section')) ganti('section', b.section, `section → ${ls(b.section)}`)
  if (isi.has('instrument')) ganti('instrument', b.instrument, `instrumen → ${b.instrument}`)
  if (isi.has('role')) ganti('role', b.role, `peran → ${lp(b.role)}`)
  if (isi.has('joinYear')) ganti('joinYear', b.joinYear, `tahun masuk → ${b.joinYear}`)
  if (isi.has('phone')) ganti('phone', b.phone, 'no. HP diperbarui')
  if (isi.has('notes')) ganti('notes', b.notes, 'catatan diperbarui')
  if (isi.has('active')) ganti('active', b.active, b.active ? 'diaktifkan' : 'dinonaktifkan')
  if (isi.has('tags') && b.tags?.length) {
    const baru = b.tags.filter((t) => !punyaTag(lokal, t))
    if (baru.length) {
      hasil.tags = normalisasiDaftarTag([...(lokal.tags ?? []), ...baru])
      perubahan.push(`tag + ${baru.join(', ')}`)
    }
  }
  return { hasil, perubahan }
}

/**
 * Susun rencana impor: tiap baris dicocokkan ke anggota lokal.
 *  - nama sama persis (satu orang) → `perbarui`/`sama`;
 *  - nama sama persis tetapi ada beberapa → dipersempit kode/section, kalau
 *    masih ganda → `mirip` (ditanya);
 *  - nama mirip (≥ AMBANG_MIRIP, mis. "Cika" vs "Cika Ayu") → `mirip`;
 *  - selain itu → `baru`.
 * Pencocokan TIDAK pernah memakai kode saja: kode contoh di template (C01…)
 * mudah bertabrakan dengan kode lama.
 */
export function rencanakanImporCsv(
  daftar: BarisCsvAnggota[],
  lokal: Member[],
  label: { section?: LabelSection; peran?: LabelPeran } = {},
): RencanaImpor {
  const hitungNama = new Map<string, number>()
  for (const b of daftar) hitungNama.set(norm(b.name), (hitungNama.get(norm(b.name)) ?? 0) + 1)
  const baris: BarisRencanaImpor[] = daftar.map((b, indeks) => {
    const gandaDiBerkas = (hitungNama.get(norm(b.name)) ?? 0) > 1 || undefined
    let persis = lokal.filter((m) => norm(m.name) === norm(b.name))
    if (persis.length > 1 && b.code) {
      const k = persis.filter((m) => norm(m.code) === norm(b.code))
      if (k.length) persis = k
    }
    if (persis.length > 1 && b.terisi.includes('section')) {
      const k = persis.filter((m) => m.section === b.section)
      if (k.length) persis = k
    }
    if (persis.length === 1) {
      const { perubahan } = terapkanBarisKeAnggota(persis[0], b, label)
      return {
        indeks,
        baris: b,
        jenis: perubahan.length ? 'perbarui' : 'sama',
        idLokal: persis[0].id,
        perubahan,
        gandaDiBerkas,
      }
    }
    const kandidat: KandidatCocok[] = (persis.length > 1 ? persis : lokal)
      .map((m) => ({ id: m.id, skor: persis.length > 1 ? 1 : miripOrang(b, m) }))
      .filter((k) => k.skor >= AMBANG_MIRIP)
      .sort((x, y) => y.skor - x.skor || x.id.localeCompare(y.id))
      .slice(0, 3)
    if (kandidat.length) {
      return { indeks, baris: b, jenis: 'mirip', idLokal: kandidat[0].id, kandidat, perubahan: [], gandaDiBerkas }
    }
    return { indeks, baris: b, jenis: 'baru', perubahan: [], gandaDiBerkas }
  })
  const jumlah: Record<JenisBarisImpor, number> = { baru: 0, perbarui: 0, sama: 0, mirip: 0 }
  for (const r of baris) jumlah[r.jenis] += 1
  return { baris, jumlah }
}

/** Keputusan untuk baris `mirip`: anggap orang baru, atau sama dengan id lokal tertentu. */
export type KeputusanImpor = 'baru' | { sama: string }

/** Kode chart unik: pakai kode berkas kalau belum dipakai, kalau tidak buat `A##`. */
export function kodeUnik(diminta: string, terpakai: Set<string>): string {
  const k = diminta.trim()
  if (k && !terpakai.has(k.toUpperCase())) {
    terpakai.add(k.toUpperCase())
    return k
  }
  let n = terpakai.size + 1
  let kode = `A${String(n).padStart(2, '0')}`
  while (terpakai.has(kode.toUpperCase())) {
    n += 1
    kode = `A${String(n).padStart(2, '0')}`
  }
  terpakai.add(kode.toUpperCase())
  return kode
}

/**
 * Hitung hasil akhir rencana: anggota yang ditulis (baru + diperbarui).
 * `buatId`/`buatToken` disuntik supaya bisa diuji deterministik.
 */
export function hasilImporCsv(opts: {
  rencana: RencanaImpor
  lokal: Member[]
  keputusan?: Record<number, KeputusanImpor>
  buatId: () => string
  buatToken: () => string
  sekarang?: number
  label?: { section?: LabelSection; peran?: LabelPeran }
}): { tulis: Member[]; baru: number; diperbarui: number; tetap: number } {
  const sekarang = opts.sekarang ?? Date.now()
  const peta = new Map(opts.lokal.map((m) => [m.id, m]))
  const terpakai = new Set(opts.lokal.map((m) => (m.code || '').trim().toUpperCase()).filter(Boolean))
  const diubah = new Map<string, Member>()
  const baruList: Member[] = []
  let tetap = 0
  for (const r of opts.rencana.baris) {
    const kep = opts.keputusan?.[r.indeks]
    let idSama: string | undefined
    if (r.jenis === 'perbarui' || r.jenis === 'sama') idSama = r.idLokal
    else if (r.jenis === 'mirip') idSama = kep && kep !== 'baru' ? kep.sama : undefined
    if (idSama && peta.has(idSama)) {
      const dasar = diubah.get(idSama) ?? peta.get(idSama)!
      // Kode chart anggota lama tidak diganti lewat impor (dipakai di set drill).
      const { hasil, perubahan } = terapkanBarisKeAnggota(dasar, r.baris, opts.label)
      if (perubahan.length) diubah.set(idSama, hasil)
      else if (!diubah.has(idSama)) tetap += 1
      continue
    }
    const b = r.baris
    baruList.push({
      id: opts.buatId(),
      code: kodeUnik(b.code, terpakai),
      name: b.name,
      panggilan: b.panggilan,
      section: b.section,
      instrument: b.instrument,
      role: b.role,
      joinYear: b.joinYear,
      phone: b.phone || undefined,
      notes: b.notes || undefined,
      active: b.active,
      tags: b.tags?.length ? b.tags : undefined,
      token: opts.buatToken(),
      createdAt: sekarang,
    })
  }
  return { tulis: [...diubah.values(), ...baruList], baru: baruList.length, diperbarui: diubah.size, tetap }
}

/* -------------------------------- Aksi massal -------------------------------- */

export type AksiMassal =
  | { jenis: 'tambahTag'; tag: string }
  | { jenis: 'lepasTag'; tag: string }
  | { jenis: 'status'; aktif: boolean }

/** Terapkan satu aksi ke anggota terpilih; hanya yang benar-benar berubah dikembalikan. */
export function terapkanAksiMassal(anggota: Member[], ids: Iterable<string>, aksi: AksiMassal): Member[] {
  const pilih = new Set(ids)
  const out: Member[] = []
  for (const m of anggota) {
    if (!pilih.has(m.id)) continue
    if (aksi.jenis === 'status') {
      const nilai = aksi.aktif ? 1 : 0
      if (m.active !== nilai) out.push({ ...m, active: nilai })
    } else if (aksi.jenis === 'tambahTag') {
      if (!bersihkanSatuTag(aksi.tag) || punyaTag(m, aksi.tag)) continue
      out.push(pasangTagKeAnggota(m, aksi.tag))
    } else {
      if (!punyaTag(m, aksi.tag)) continue
      out.push(lepasTagDariAnggota(m, aksi.tag))
    }
  }
  return out
}

/** Teks ringkas hasil aksi massal untuk toast. */
export function teksAksiMassal(aksi: AksiMassal, n: number): string {
  if (n === 0) return 'Tidak ada yang berubah'
  if (aksi.jenis === 'status') return `${n} anggota ${aksi.aktif ? 'diaktifkan' : 'dinonaktifkan'}`
  if (aksi.jenis === 'tambahTag') return `Tag #${bersihkanSatuTag(aksi.tag)} dipasang ke ${n} anggota`
  return `Tag #${bersihkanSatuTag(aksi.tag)} dilepas dari ${n} anggota`
}

/* -------------------------------- Rekap roster ------------------------------- */

/** Satu sel rekap: anggota aktif & nonaktif di kelompok itu. */
export interface SelRekap {
  aktif: number
  nonaktif: number
}

export interface BarisRekapRoster {
  /** Nama instrumen (sudah dirapikan), atau "—" bila kosong. */
  instrumen: string
  /** Satu sel per kelompok, urut seperti `kelompok`. */
  sel: SelRekap[]
  /** Anggota aktif tanpa kelompok roster mana pun. */
  lainnya: number
  totalAktif: number
}

export interface SeksiRekapRoster {
  section: string
  label: string
  baris: BarisRekapRoster[]
  jumlah: BarisRekapRoster
}

export interface RekapRoster {
  kelompok: string[]
  seksi: SeksiRekapRoster[]
  total: BarisRekapRoster
  /** Nama per kelompok (aktif dulu), untuk lampiran cetak. */
  nama: { kelompok: string; anggota: { name: string; section: string; instrumen: string; aktif: boolean }[] }[]
}

function barisKosong(instrumen: string, n: number): BarisRekapRoster {
  return { instrumen, sel: Array.from({ length: n }, () => ({ aktif: 0, nonaktif: 0 })), lainnya: 0, totalAktif: 0 }
}

function tambahKe(t: BarisRekapRoster, b: BarisRekapRoster) {
  b.sel.forEach((s, i) => {
    t.sel[i].aktif += s.aktif
    t.sel[i].nonaktif += s.nonaktif
  })
  t.lainnya += b.lainnya
  t.totalAktif += b.totalAktif
}

/** Rapikan nama instrumen untuk pengelompokan ("trumpet " = "Trumpet"). */
function kunciInstrumen(s: string | undefined): { kunci: string; tampil: string } {
  const tampil = (s ?? '').trim().replace(/\s+/g, ' ')
  return tampil ? { kunci: tampil.toLowerCase(), tampil } : { kunci: '', tampil: '—' }
}

/**
 * Rekap roster per section × instrumen. Tiap anggota masuk ke kelompok
 * **pertama** yang dipegangnya (urutan kelompok = prioritas), sehingga
 * jumlah per baris selalu cocok. Anggota nonaktif tanpa kelompok (mis. arsip
 * lama) tidak dihitung sama sekali.
 */
export function rekapRoster(
  anggota: readonly Member[],
  kelompok: readonly string[],
  sections: readonly { id: string; label: string }[],
): RekapRoster {
  const k = [...kelompok]
  const n = k.length
  const perSeksi = new Map<string, Map<string, BarisRekapRoster>>()
  const nama = k.map((kel) => ({ kelompok: kel, anggota: [] as RekapRoster['nama'][number]['anggota'] }))
  for (const m of anggota) {
    const g = kelompokAnggota(m, k)
    const aktif = m.active === 1
    if (g < 0 && !aktif) continue
    const { kunci, tampil } = kunciInstrumen(m.instrument)
    const peta = perSeksi.get(m.section) ?? new Map<string, BarisRekapRoster>()
    perSeksi.set(m.section, peta)
    const b = peta.get(kunci) ?? barisKosong(tampil, n)
    peta.set(kunci, b)
    if (g >= 0) {
      if (aktif) b.sel[g].aktif += 1
      else b.sel[g].nonaktif += 1
      nama[g].anggota.push({ name: m.name, section: m.section, instrumen: tampil, aktif })
    } else b.lainnya += 1
    if (aktif) b.totalAktif += 1
  }
  const urutan = [...sections.map((s) => s.id), ...[...perSeksi.keys()].filter((id) => !sections.some((s) => s.id === id))]
  const total = barisKosong('Total', n)
  const seksi: SeksiRekapRoster[] = []
  for (const id of urutan) {
    const peta = perSeksi.get(id)
    if (!peta) continue
    const baris = [...peta.values()].sort((a, b) =>
      a.instrumen === '—' ? 1 : b.instrumen === '—' ? -1 : a.instrumen.localeCompare(b.instrumen),
    )
    const jumlah = barisKosong('Jumlah', n)
    for (const b of baris) tambahKe(jumlah, b)
    tambahKe(total, jumlah)
    seksi.push({ section: id, label: sections.find((s) => s.id === id)?.label ?? id, baris, jumlah })
  }
  for (const x of nama) {
    x.anggota.sort((a, b) => Number(b.aktif) - Number(a.aktif) || a.section.localeCompare(b.section) || a.name.localeCompare(b.name))
  }
  return { kelompok: k, seksi, total, nama }
}

/** Teks satu sel rekap: "12", "12 +3", atau "+3" (yang nonaktif diberi tanda +). */
export function teksSelRekap(s: SelRekap): string {
  if (!s.aktif && !s.nonaktif) return '–'
  if (!s.nonaktif) return String(s.aktif)
  return s.aktif ? `${s.aktif} +${s.nonaktif}` : `+${s.nonaktif}`
}

/** Tabel rekap untuk diunduh sebagai CSV (baris pertama = judul). */
export function barisCsvRekapRoster(r: RekapRoster): (string | number)[][] {
  const judul: (string | number)[] = ['Section', 'Instrumen']
  for (const k of r.kelompok) judul.push(`${k} (aktif)`, `${k} (nonaktif)`)
  judul.push('Lainnya (aktif)', 'Total aktif')
  const baris = (seksi: string, b: BarisRekapRoster) => {
    const out: (string | number)[] = [seksi, b.instrumen]
    for (const s of b.sel) out.push(s.aktif, s.nonaktif)
    out.push(b.lainnya, b.totalAktif)
    return out
  }
  const rows: (string | number)[][] = [judul]
  for (const s of r.seksi) {
    for (const b of s.baris) rows.push(baris(s.label, b))
    rows.push(baris(s.label, s.jumlah))
  }
  rows.push(baris('Semua', r.total))
  return rows
}
