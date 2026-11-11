/**
 * #36 — Program Latsar (program latihan dasar anggota baru) & Pemantau Syarat
 * Pelantikan. Modul murni: tanpa Dexie, tanpa React — diuji langsung oleh
 * `qa/program-latsar-logika.mjs`.
 *
 * 1. **Generator** — pola mingguan (hari + jam) + tanggal tambahan/libur +
 *    tonggak (Hakrab, Pelantikan, Camp, …) + fase berpola isi sesi menjadi
 *    daftar sesi jadwal. Sesi yang sudah ada di tanggal yang sama
 *    **ditautkan**, bukan diduplikat; rencana yang sudah diisi pelatih dan
 *    sesi yang sudah berjalan tidak pernah ditimpa diam-diam.
 * 2. **Keabsahan izin/sakit** — izin sah bila tertulis sebelum batas lapor
 *    (bawaan: jam mulai sesi), kategorinya termasuk daftar musim ini, dan
 *    buktinya sudah diterima; sakit sah bila dilaporkan paling lambat N jam
 *    sesudah mulai. Putusan pelatih mengalahkan semuanya.
 * 3. **Syarat pelantikan (v2.8, berbasis rasio)** — jumlah sesi Latsar
 *    berubah tiap musim, jadi batasnya pecahan dari N sesi wajib sejak
 *    bergabung: hadir ≥ ⌈7/12·N⌉, alpa ≤ bulat(1/4·N), telat berjatah ≤
 *    bulat(1/6·N). Datang ≤ 30 menit sesudah mulai = hadir; sampai separuh
 *    durasi sesi dengan alasan + bukti = hadir memakai jatah telat (urut
 *    tanggal); selebihnya tidak dihitung hadir (= alpa). Izin/sakit sah
 *    tidak mengurangi jatah alpa. Status dihitung **ke depan**: sudah
 *    memenuhi, masih bisa, kritis, atau pasti susulan.
 */
import type {
  AttendanceRecord,
  AturanPelantikan,
  FaseProgram,
  KategoriIzin,
  Member,
  PesertaProgram,
  PolaSesi,
  ProgramLatihan,
  RasioSesi,
  Session,
  SessionType,
  TargetNeraca,
  TonggakProgram,
} from '../db/types'
import { hariSenin, tambahHari } from './kalender'
import { JENIS_BERENCANA, PRESET_TARGET, salinRencana } from './ranahSesi'

/* ================================ tanggal ================================ */

export function rentangTanggal(dari: string, sampai: string): string[] {
  const hasil: string[] = []
  if (!dari || !sampai || sampai < dari) return dari && !sampai ? [dari] : hasil
  for (let t = dari; t <= sampai && hasil.length < 800; t = tambahHari(t, 1)) hasil.push(t)
  return hasil
}

/** Tonggak yang menggantikan latihan rutin di tanggalnya (bukan tes). */
const TONGGAK_MENGGANTI: TonggakProgram['jenis'][] = ['acara', 'pelantikan', 'camp', 'libur']

export function tanggalTonggak(t: TonggakProgram): string[] {
  if (!t.dari) return []
  return rentangTanggal(t.dari, t.sampai && t.sampai >= t.dari ? t.sampai : t.dari)
}

/**
 * Tanggal latihan rutin program: hari pola mingguan di dalam rentang, minus
 * libur & tanggal tonggak yang menggantikan latihan, plus tanggal tambahan.
 */
export function tanggalLatihan(p: Pick<ProgramLatihan, 'mulai' | 'selesai' | 'hari' | 'tambahan' | 'libur' | 'tonggak'>): string[] {
  const hari = new Set(p.hari)
  const tiada = new Set(p.libur)
  for (const t of p.tonggak) if (TONGGAK_MENGGANTI.includes(t.jenis)) for (const x of tanggalTonggak(t)) tiada.add(x)
  const hasil = new Set<string>()
  for (const t of rentangTanggal(p.mulai, p.selesai)) if (hari.has(hariSenin(t)) && !tiada.has(t)) hasil.add(t)
  for (const t of p.tambahan) if (t && !tiada.has(t)) hasil.add(t)
  return [...hasil].sort()
}

export function faseUntuk(p: Pick<ProgramLatihan, 'fase'>, iso: string): FaseProgram | null {
  return p.fase.find((f) => iso >= f.dari && iso <= f.sampai) ?? null
}

/** Tonggak pelantikan pertama yang bertanggal. */
export function tonggakPelantikan(p: Pick<ProgramLatihan, 'tonggak'>): TonggakProgram | null {
  return (
    p.tonggak
      .filter((t) => t.jenis === 'pelantikan' && t.dari)
      .sort((a, b) => (a.dari! < b.dari! ? -1 : 1))[0] ?? null
  )
}

export function tonggakCamp(p: Pick<ProgramLatihan, 'tonggak'>): TonggakProgram | null {
  return p.tonggak.find((t) => t.jenis === 'camp') ?? null
}

/** Mulai sesi sebagai epoch ms waktu setempat. */
export function mulaiSesiMs(s: Pick<Session, 'date' | 'startTime'>): number {
  const [y, m, d] = s.date.split('-').map(Number)
  const [hh, mm] = (s.startTime || '00:00').split(':').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0).getTime()
}

/* ================================ template ================================ */

/**
 * v2.8 — 7 kategori izin bawaan (Lembar Info Musim CAB 42). Semuanya wajib
 * berbukti. Rapat organisasi, kerabat selain orang tua/om/tante/kakek/nenek,
 * dan alasan tanpa bukti bukan izin.
 */
export const KATEGORI_IZIN_BAKU: readonly KategoriIzin[] = [
  { id: 'sakit', nama: 'Sakit parah', bukti: 'Surat dokter' },
  { id: 'ortu', nama: 'Orang tua berkunjung', bukti: 'Orang tua/wali menghubungi kepelatihan langsung' },
  { id: 'kuliah', nama: 'Praktikum / asistensi', bukti: 'Foto kegiatan' },
  { id: 'agama', nama: 'Acara keagamaan', bukti: 'Foto kegiatan' },
  { id: 'duka', nama: 'Berduka', bukti: 'Foto / kabar duka' },
  { id: 'lomba', nama: 'Lomba mewakili kampus/daerah', bukti: 'Surat tugas / keikutsertaan' },
  { id: 'organisasi', nama: 'Acara besar organisasi kampus (hari-H)', bukti: 'Foto kegiatan' },
]

/** Aturan yang semua field-nya sudah terisi — hasil `lengkapiAturan()`. */
export type AturanLengkap = Required<
  Pick<AturanPelantikan, 'rasioHadir' | 'rasioAlpa' | 'rasioTelat' | 'toleransiMenit' | 'wajibForm' | 'wajibBukti' | 'kategoriIzin' | 'sakitMaksJam'>
> &
  Pick<AturanPelantikan, 'batasJatahMenit' | 'batasIzin' | 'batasGabung'>

export const ATURAN_BAKU: AturanLengkap = {
  rasioHadir: [7, 12],
  rasioAlpa: [1, 4],
  rasioTelat: [1, 6],
  toleransiMenit: 30,
  wajibForm: true,
  wajibBukti: true,
  kategoriIzin: KATEGORI_IZIN_BAKU.map((k) => ({ ...k })),
  sakitMaksJam: 24,
}

function rasioSah(r: unknown, cadangan: RasioSesi): RasioSesi {
  if (!Array.isArray(r) || r.length !== 2) return [...cadangan] as RasioSesi
  const a = Math.round(Number(r[0]))
  const b = Math.round(Number(r[1]))
  if (!Number.isFinite(a) || !Number.isFinite(b) || a < 0 || b < 1 || a > b) return [...cadangan] as RasioSesi
  return [a, b]
}

const JAM_RE = /^([01]\d|2[0-3]):[0-5]\d$/

/**
 * Lengkapi aturan tersimpan dengan nilai bawaan. Data #36 (`persenMin`,
 * `hadirMin`) dibuang: model rasio menggantikannya seluruhnya — tidak ada
 * dua aturan yang berlaku bersamaan.
 */
export function lengkapiAturan(a?: Partial<AturanPelantikan> | null): AturanLengkap {
  const x = (a ?? {}) as Partial<AturanPelantikan> & Record<string, unknown>
  const angka = (v: unknown, cadangan: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : cadangan)
  const kategori = Array.isArray(x.kategoriIzin)
    ? x.kategoriIzin
        .filter((k) => k && typeof k.id === 'string' && k.id && k.id !== 'lain' && typeof k.nama === 'string')
        .map((k) => ({ id: k.id, nama: k.nama, bukti: typeof k.bukti === 'string' ? k.bukti : '' }))
    : null
  const out: AturanLengkap = {
    rasioHadir: rasioSah(x.rasioHadir, ATURAN_BAKU.rasioHadir),
    rasioAlpa: rasioSah(x.rasioAlpa, ATURAN_BAKU.rasioAlpa),
    rasioTelat: rasioSah(x.rasioTelat, ATURAN_BAKU.rasioTelat),
    toleransiMenit: Math.round(angka(x.toleransiMenit, ATURAN_BAKU.toleransiMenit)),
    wajibForm: typeof x.wajibForm === 'boolean' ? x.wajibForm : ATURAN_BAKU.wajibForm,
    wajibBukti: typeof x.wajibBukti === 'boolean' ? x.wajibBukti : ATURAN_BAKU.wajibBukti,
    kategoriIzin: kategori ?? KATEGORI_IZIN_BAKU.map((k) => ({ ...k })),
    sakitMaksJam: angka(x.sakitMaksJam, ATURAN_BAKU.sakitMaksJam),
  }
  if (typeof x.batasJatahMenit === 'number' && Number.isFinite(x.batasJatahMenit) && x.batasJatahMenit >= 0)
    out.batasJatahMenit = Math.round(x.batasJatahMenit)
  if (typeof x.batasIzin === 'string' && JAM_RE.test(x.batasIzin)) out.batasIzin = x.batasIzin
  if (typeof x.batasGabung === 'string' && x.batasGabung) out.batasGabung = x.batasGabung
  return out
}

/**
 * Batas dari N sesi wajib. Bilangan bulat murni (tanpa galat pecahan):
 * hadir = ⌈a·N/b⌉; alpa & telat dibulatkan biasa (,5 ke atas).
 * N=12 → 7/3/2 · N=7 → 5/2/1 · N=10 → 6/3/2.
 */
export function batasRasio(n: number, a: Pick<AturanLengkap, 'rasioHadir' | 'rasioAlpa' | 'rasioTelat'>): { hadir: number; alpa: number; telat: number } {
  const N = Math.max(0, Math.round(n))
  const atas = ([p, q]: RasioSesi) => Math.floor((p * N + q - 1) / q)
  const bulat = ([p, q]: RasioSesi) => Math.floor((2 * p * N + q) / (2 * q))
  return { hadir: atas(a.rasioHadir), alpa: bulat(a.rasioAlpa), telat: bulat(a.rasioTelat) }
}

/** "7/12" */
export const teksRasio = (r: RasioSesi) => `${r[0]}/${r[1]}`

export const LABEL_TONGGAK: Record<TonggakProgram['jenis'], string> = {
  acara: 'Acara',
  tes: 'Tes',
  pelantikan: 'Pelantikan',
  camp: 'Camp',
  libur: 'Libur',
}

/** Warna hex tonggak & fase untuk garis waktu (layar & cetak). */
export const WARNA_TONGGAK: Record<TonggakProgram['jenis'], string> = {
  acara: '#8b5cf6',
  tes: '#eab308',
  pelantikan: '#ef4444',
  camp: '#0ea5e9',
  libur: '#64748b',
}
export const WARNA_FASE = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#14b8a6', '#a855f7']

export interface PolaTemplate {
  /** Id pola A/B/C di pustaka (cocok dengan `polaContohLatsar`). */
  A?: string
  B?: string
  C?: string
}

/** Cari pola contoh Latsar A/B/C di pustaka menurut namanya. */
export function cariPolaLatsar(pustaka: PolaSesi[] | undefined): PolaTemplate {
  const cari = (h: string) => (pustaka ?? []).find((x) => new RegExp(`^latsar ${h}\\b`, 'i').test(x.nama.trim()))?.id
  return { A: cari('A'), B: cari('B'), C: cari('C') }
}

function polaHari(hari: number[], pilih: (h: number, i: number) => string | undefined): Record<string, string> {
  const r: Record<string, string> = {}
  hari.forEach((h, i) => {
    const id = pilih(h, i)
    if (id) r[String(h)] = id
  })
  return r
}

/**
 * Usulan tiga fase Latsar:
 *  - **Fase 1 — Dasar bersama** sampai sehari sebelum acara pertama (mis.
 *    Hakrab) atau sepertiga awal program;
 *  - **Fase 2 — Teknik seksi** sampai sehari sebelum pelantikan;
 *  - **Fase 3 — Menjelang tampil** sesudah pelantikan sampai akhir.
 * Pola isi bergiliran A/B/C sesuai fase; semuanya bebas diubah.
 */
export function usulFase(
  p: Pick<ProgramLatihan, 'mulai' | 'selesai' | 'hari' | 'tonggak' | 'tambahan'>,
  pola: PolaTemplate,
  buatId: (awalan: string) => string,
): FaseProgram[] {
  if (!p.mulai || !p.selesai || p.selesai < p.mulai) return []
  const hari = [...new Set([...p.hari, ...p.tambahan.map(hariSenin)])].sort()
  const pel = tonggakPelantikan(p)
  const acara = p.tonggak
    .filter((t) => t.jenis === 'acara' && t.dari && t.dari > p.mulai && (!pel?.dari || t.dari < pel.dari))
    .sort((a, b) => (a.dari! < b.dari! ? -1 : 1))[0]
  const total = rentangTanggal(p.mulai, p.selesai).length
  const akhir1 = acara?.dari ? tambahHari(acara.dari, -1) : tambahHari(p.mulai, Math.max(0, Math.round(total / 3) - 1))
  const pelDari = pel?.dari && pel.dari > akhir1 ? pel.dari : null
  const pelSampai = pel?.dari ? (pel.sampai && pel.sampai >= pel.dari ? pel.sampai : pel.dari) : null
  const akhir2 = pelDari ? tambahHari(pelDari, -1) : tambahHari(akhir1, Math.max(1, Math.round((total - rentangTanggal(p.mulai, akhir1).length) / 2)))
  const mulai3 = pelSampai && pelDari ? tambahHari(pelSampai, 1) : tambahHari(akhir2, 1)
  const target = (i: number): TargetNeraca | undefined => (PRESET_TARGET[i] ? { ...PRESET_TARGET[i], persen: { ...PRESET_TARGET[i].persen } } : undefined)
  const giliran = (urut: (keyof PolaTemplate)[]) => polaHari(hari, (_h, i) => pola[urut[i % urut.length]])
  const fase: FaseProgram[] = [
    { id: buatId('fase_'), nama: 'Fase 1 — Dasar bersama', dari: p.mulai, sampai: akhir1 < p.selesai ? akhir1 : p.selesai, polaPerHari: giliran(['A', 'B', 'A']), target: target(0) },
  ]
  if (akhir1 < p.selesai)
    fase.push({ id: buatId('fase_'), nama: 'Fase 2 — Teknik seksi', dari: tambahHari(akhir1, 1), sampai: akhir2 < p.selesai ? akhir2 : p.selesai, polaPerHari: giliran(['B', 'C', 'B']), target: target(1) })
  if (akhir2 < p.selesai && mulai3 <= p.selesai)
    fase.push({ id: buatId('fase_'), nama: 'Fase 3 — Menjelang tampil', dari: mulai3, sampai: p.selesai, polaPerHari: giliran(['C', 'B', 'C']), target: target(2) })
  return fase
}

export function programBaru(buatId: (awalan: string) => string, mulai: string, sekarang = Date.now()): ProgramLatihan {
  return {
    id: buatId('prog_'),
    nama: 'Latsar',
    mulai,
    selesai: tambahHari(mulai, 41),
    hari: [1, 3, 4],
    jamMulai: '18:00',
    jamSelesai: '20:00',
    tambahan: [],
    libur: [],
    fase: [],
    tonggak: [],
    sesiIds: [],
    wajibIds: [],
    peserta: [],
    aturan: lengkapiAturan(ATURAN_BAKU),
    dibuat: sekarang,
    diubah: sekarang,
  }
}

/** Kunci tanggal yang "bermasalah" di program: urutan, fase tumpang tindih, dsb. */
export function periksaProgram(p: ProgramLatihan): string[] {
  const out: string[] = []
  if (!p.nama.trim()) out.push('Nama program masih kosong.')
  if (!p.mulai || !p.selesai || p.selesai < p.mulai) out.push('Tanggal selesai harus sesudah tanggal mulai.')
  if (!p.hari.length && !p.tambahan.length) out.push('Pilih minimal satu hari latihan.')
  if (p.jamSelesai <= p.jamMulai) out.push('Jam selesai harus sesudah jam mulai.')
  const fase = [...p.fase].sort((a, b) => (a.dari < b.dari ? -1 : 1))
  for (let i = 0; i < fase.length; i++) {
    if (fase[i].sampai < fase[i].dari) out.push(`${fase[i].nama}: tanggal akhirnya sebelum tanggal awal.`)
    if (i > 0 && fase[i].dari <= fase[i - 1].sampai) out.push(`${fase[i - 1].nama} dan ${fase[i].nama} tumpang tindih.`)
  }
  for (const t of p.tonggak) {
    if (!t.nama.trim()) out.push('Ada tonggak tanpa nama.')
    if (t.dari && t.sampai && t.sampai < t.dari) out.push(`${t.nama}: tanggal akhirnya sebelum tanggal awal.`)
  }
  return out
}

/* ================================ rencana ================================ */

export type AksiRencana = 'buat' | 'tautkan' | 'tetap'

export interface ItemRencana {
  tanggal: string
  /** `latihan` = latihan rutin program; selain itu tonggak. */
  jenis: 'latihan' | TonggakProgram['jenis']
  judul: string
  fase: FaseProgram | null
  pola: PolaSesi | null
  aksi: AksiRencana
  /** Sesi hasil (baru atau sesi lama yang diperbarui). */
  sesi: Session
  /** Rencana sesi diisi dari pola pada penerapan ini. */
  isiRencana: boolean
  /** Usulan bawaan: dihitung untuk syarat pelantikan. */
  wajib: boolean
  catatan?: string
}

export interface RencanaProgram {
  item: ItemRencana[]
  /** Sesi milik program yang tidak lagi cocok dengan tanggal mana pun — dilepas (tidak dihapus). */
  lepas: Session[]
}

function jenisSesiTonggak(j: TonggakProgram['jenis']): SessionType {
  return j === 'tes' ? 'latihan' : 'lainnya'
}

function sudahBerjalan(s: Session): boolean {
  return (s.realisasiLatihan?.length ?? 0) > 0 || !!s.mulaiNyata
}

/**
 * Susun rencana penerapan program ke jadwal (pratinjau). Tidak menulis apa
 * pun; `terapkanRencana` yang menghasilkan sesi & program akhirnya.
 */
export function rencanakanProgram(
  p: ProgramLatihan,
  semua: Session[],
  pustaka: PolaSesi[],
  opsi: { buatId: (awalan: string) => string; mode: 'kosong' | 'ganti'; sekarang?: number },
): RencanaProgram {
  const sekarang = opsi.sekarang ?? Date.now()
  const milik = new Set(p.sesiIds)
  const terpakai = new Set<string>()
  const perTanggal = new Map<string, Session[]>()
  for (const s of semua) {
    const d = perTanggal.get(s.date) ?? []
    d.push(s)
    perTanggal.set(s.date, d)
  }
  const pel = tonggakPelantikan(p)
  const item: ItemRencana[] = []

  const cocokLatihan = (t: string): Session | null => {
    const calon = (perTanggal.get(t) ?? []).filter((s) => !terpakai.has(s.id) && JENIS_BERENCANA.includes(s.type))
    return (
      calon.find((s) => milik.has(s.id)) ??
      calon.find((s) => s.startTime === p.jamMulai) ??
      calon[0] ??
      null
    )
  }
  const cocokTonggak = (t: string, nama: string): Session | null => {
    const n = nama.trim().toLowerCase()
    const calon = (perTanggal.get(t) ?? []).filter((s) => !terpakai.has(s.id))
    return (
      calon.find((s) => milik.has(s.id) && s.title.trim().toLowerCase() === n) ??
      calon.find((s) => !JENIS_BERENCANA.includes(s.type) && n && s.title.toLowerCase().includes(n)) ??
      calon.find((s) => milik.has(s.id) && !JENIS_BERENCANA.includes(s.type)) ??
      null
    )
  }

  for (const t of tanggalLatihan(p)) {
    const fase = faseUntuk(p, t)
    const polaId = fase?.polaPerHari[String(hariSenin(t))]
    const pola = polaId ? pustaka.find((x) => x.id === polaId) ?? null : null
    const lama = cocokLatihan(t)
    const wajib = !pel?.dari || t < pel.dari
    if (lama) {
      terpakai.add(lama.id)
      const kosong = !(lama.rencanaLatihan?.length ?? 0)
      const isi = !!pola && !sudahBerjalan(lama) && (kosong || opsi.mode === 'ganti')
      const sesi: Session = isi ? { ...lama, rencanaLatihan: salinRencana(pola!.rencana, opsi.buatId) } : lama
      item.push({
        tanggal: t,
        jenis: 'latihan',
        judul: lama.title,
        fase,
        pola,
        aksi: milik.has(lama.id) && !isi ? 'tetap' : 'tautkan',
        sesi,
        isiRencana: isi,
        wajib: p.wajibIds.length && milik.has(lama.id) ? p.wajibIds.includes(lama.id) : wajib,
        catatan: !pola
          ? undefined
          : sudahBerjalan(lama)
            ? 'sudah berjalan — rencana tidak diubah'
            : !kosong && opsi.mode === 'kosong'
              ? 'sudah punya rencana — dibiarkan'
              : undefined,
      })
    } else {
      item.push({
        tanggal: t,
        jenis: 'latihan',
        judul: p.nama,
        fase,
        pola,
        aksi: 'buat',
        sesi: {
          id: opsi.buatId('s_'),
          title: p.nama.trim() || 'Latsar',
          type: 'latihan',
          date: t,
          startTime: p.jamMulai,
          endTime: p.jamSelesai,
          ...(p.tempat ? { place: p.tempat } : {}),
          notes: fase?.nama ?? '',
          checklist: [],
          createdAt: sekarang,
          ...(pola ? { rencanaLatihan: salinRencana(pola.rencana, opsi.buatId) } : {}),
        },
        isiRencana: !!pola,
        wajib,
      })
    }
  }

  for (const tg of p.tonggak) {
    if (tg.jenis === 'libur') continue
    for (const t of tanggalTonggak(tg)) {
      const lama = cocokTonggak(t, tg.nama)
      if (lama) {
        terpakai.add(lama.id)
        item.push({
          tanggal: t,
          jenis: tg.jenis,
          judul: lama.title,
          fase: faseUntuk(p, t),
          pola: null,
          aksi: milik.has(lama.id) ? 'tetap' : 'tautkan',
          sesi: lama,
          isiRencana: false,
          wajib: milik.has(lama.id) ? p.wajibIds.includes(lama.id) : false,
        })
      } else {
        item.push({
          tanggal: t,
          jenis: tg.jenis,
          judul: tg.nama,
          fase: faseUntuk(p, t),
          pola: null,
          aksi: 'buat',
          sesi: {
            id: opsi.buatId('s_'),
            title: tg.nama.trim() || LABEL_TONGGAK[tg.jenis],
            type: jenisSesiTonggak(tg.jenis),
            date: t,
            startTime: tg.jamMulai || p.jamMulai,
            endTime: tg.jamSelesai || p.jamSelesai,
            ...(p.tempat ? { place: p.tempat } : {}),
            notes: `${LABEL_TONGGAK[tg.jenis]} · ${p.nama}`,
            checklist: [],
            createdAt: sekarang,
          },
          isiRencana: false,
          wajib: false,
        })
      }
    }
  }

  item.sort((a, b) => (a.tanggal === b.tanggal ? a.sesi.startTime.localeCompare(b.sesi.startTime) : a.tanggal < b.tanggal ? -1 : 1))
  const lepas = semua.filter((s) => milik.has(s.id) && !terpakai.has(s.id))
  return { item, lepas }
}

/**
 * Hasil akhir penerapan: sesi yang perlu ditulis & program dengan daftar
 * sesi/wajib terbaru. `wajib` = keputusan akhir per id sesi dari pratinjau.
 */
export function terapkanRencana(
  p: ProgramLatihan,
  r: RencanaProgram,
  wajib: Record<string, boolean>,
  sekarang = Date.now(),
): { tulis: Session[]; program: ProgramLatihan } {
  const tulis = r.item.filter((x) => x.aksi === 'buat' || x.isiRencana).map((x) => x.sesi)
  const ids = r.item.map((x) => x.sesi.id)
  const wajibIds = r.item.filter((x) => wajib[x.sesi.id] ?? x.wajib).map((x) => x.sesi.id)
  return { tulis, program: { ...p, sesiIds: ids, wajibIds, diubah: sekarang } }
}

export function ringkasRencana(r: RencanaProgram, wajib: Record<string, boolean>) {
  return {
    buat: r.item.filter((x) => x.aksi === 'buat').length,
    tautkan: r.item.filter((x) => x.aksi === 'tautkan').length,
    tetap: r.item.filter((x) => x.aksi === 'tetap').length,
    isi: r.item.filter((x) => x.isiRencana).length,
    wajib: r.item.filter((x) => wajib[x.sesi.id] ?? x.wajib).length,
    latihan: r.item.filter((x) => x.jenis === 'latihan').length,
    lepas: r.lepas.length,
  }
}

/* ============================ keabsahan izin ============================ */

export type KodeKehadiran =
  | 'hadir'
  | 'telat-jatah'
  | 'telat'
  | 'tanpa-form'
  | 'izin-sah'
  | 'sakit-sah'
  | 'izin-telat'
  | 'sakit-telat'
  | 'tanpa-cap'
  | 'tanpa-bukti'
  | 'izin-ditolak'
  | 'alpha'
  | 'kosong'
  | 'mendatang'

export const LABEL_KODE: Record<KodeKehadiran, string> = {
  hadir: 'Hadir',
  'telat-jatah': 'Telat berjatah (dihitung hadir)',
  telat: 'Telat — tidak dihitung hadir',
  'tanpa-form': 'Hadir tanpa Google Form',
  'izin-sah': 'Izin sah',
  'sakit-sah': 'Sakit sah',
  'izin-telat': 'Izin terlambat',
  'sakit-telat': 'Sakit terlambat',
  'tanpa-cap': 'Izin/sakit tanpa jam lapor',
  'tanpa-bukti': 'Izin/sakit tanpa bukti',
  'izin-ditolak': 'Izin tidak diterima',
  alpha: 'Tanpa keterangan',
  kosong: 'Belum diisi',
  mendatang: 'Belum berlangsung',
}

export const SINGKAT_KODE: Record<KodeKehadiran, string> = {
  hadir: 'H',
  'telat-jatah': 'T',
  telat: 'T!',
  'tanpa-form': 'F!',
  'izin-sah': 'I',
  'sakit-sah': 'S',
  'izin-telat': 'I!',
  'sakit-telat': 'S!',
  'tanpa-cap': 'I?',
  'tanpa-bukti': 'B?',
  'izin-ditolak': 'I×',
  alpha: 'A',
  kosong: '·',
  mendatang: '',
}

/** Hex untuk sel rekap (layar & cetak). */
export const WARNA_KODE: Record<KodeKehadiran, string> = {
  hadir: '#10b981',
  'telat-jatah': '#0d9488',
  telat: '#ea580c',
  'tanpa-form': '#f97316',
  'izin-sah': '#0ea5e9',
  'sakit-sah': '#f59e0b',
  'izin-telat': '#f43f5e',
  'sakit-telat': '#f43f5e',
  'tanpa-cap': '#fb7185',
  'tanpa-bukti': '#db2777',
  'izin-ditolak': '#be123c',
  alpha: '#e11d48',
  kosong: '#94a3b8',
  mendatang: '#cbd5e1',
}

/** Kode yang dihitung hadir. */
export const KODE_HADIR: readonly KodeKehadiran[] = ['hadir', 'telat-jatah']
/** Kode tidak hadir yang sah — tidak memakai jatah alpa. */
export const KODE_SAH: readonly KodeKehadiran[] = ['izin-sah', 'sakit-sah']
/**
 * Kode yang dihitung **alpa** (memakai jatah alpa). `kosong` sengaja tidak
 * termasuk: itu tunggakan pengisian absen, bukan perilaku anak — ditampilkan
 * sebagai peringatan sampai diisi.
 */
export const KODE_ALPA: readonly KodeKehadiran[] = [
  'telat',
  'tanpa-form',
  'izin-telat',
  'sakit-telat',
  'tanpa-cap',
  'tanpa-bukti',
  'izin-ditolak',
  'alpha',
]
/** Urutan legenda (layar & cetak). */
export const LEGENDA_KODE: readonly KodeKehadiran[] = [
  'hadir',
  'telat-jatah',
  'telat',
  'tanpa-form',
  'izin-sah',
  'sakit-sah',
  'izin-telat',
  'sakit-telat',
  'tanpa-cap',
  'tanpa-bukti',
  'izin-ditolak',
  'alpha',
  'kosong',
]

export type KeabsahanIzin = 'sah' | 'telat' | 'tanpa-cap' | 'tanpa-bukti' | 'ditolak'

type AturanIzin = Pick<AturanLengkap, 'sakitMaksJam' | 'wajibBukti' | 'kategoriIzin' | 'batasIzin'>

const adaBukti = (r: Pick<AttendanceRecord, 'bukti'>) => !!r.bukti?.trim()

/** Kategori izin menurut id (`null` bila tidak ada / di luar daftar). */
export function kategoriIzin(a: Pick<AturanLengkap, 'kategoriIzin'>, id: string | undefined): KategoriIzin | null {
  if (!id) return null
  return a.kategoriIzin.find((k) => k.id === id) ?? null
}

/**
 * Batas lapor (epoch ms): izin — sebelum `batasIzin` pada hari-H (bawaan jam
 * mulai sesi, dan tidak pernah lebih lambat dari itu); sakit — paling lambat
 * `sakitMaksJam` jam sesudah sesi mulai.
 */
export function batasLapor(
  status: 'izin' | 'sakit',
  s: Pick<Session, 'date' | 'startTime'>,
  aturan: Pick<AturanLengkap, 'sakitMaksJam' | 'batasIzin'>,
): number {
  const mulai = mulaiSesiMs(s)
  if (status === 'sakit') return mulai + aturan.sakitMaksJam * 3_600_000
  if (aturan.batasIzin) return Math.min(mulai, mulaiSesiMs({ date: s.date, startTime: aturan.batasIzin }))
  return mulai
}

/**
 * Keabsahan satu catatan izin/sakit; `null` untuk hadir/alpha. Urutan:
 * putusan pelatih → jam lapor → kategori → bukti.
 */
export function keabsahanIzin(
  r: Pick<AttendanceRecord, 'status' | 'dilaporAt' | 'putusanIzin' | 'kategoriIzin' | 'bukti'>,
  s: Pick<Session, 'date' | 'startTime'>,
  aturan: AturanIzin,
): KeabsahanIzin | null {
  if (r.status !== 'izin' && r.status !== 'sakit') return null
  if (r.putusanIzin === 'sah') return 'sah'
  if (r.putusanIzin === 'tidak-sah') return 'ditolak'
  if (r.dilaporAt == null) return 'tanpa-cap'
  const batas = batasLapor(r.status, s, aturan)
  if (r.status === 'izin' ? r.dilaporAt >= batas : r.dilaporAt > batas) return 'telat'
  if (r.kategoriIzin && !kategoriIzin(aturan, r.kategoriIzin)) return 'ditolak'
  if (aturan.wajibBukti && !adaBukti(r)) return 'tanpa-bukti'
  return 'sah'
}

/** Jendela datang sebuah sesi (epoch ms). */
export function jendelaDatang(
  s: Pick<Session, 'date' | 'startTime' | 'endTime'>,
  a: Pick<AturanLengkap, 'toleransiMenit' | 'batasJatahMenit'>,
): { mulai: number; tepat: number; batasJatah: number } {
  const mulai = mulaiSesiMs(s)
  const selesai = s.endTime ? mulaiSesiMs({ date: s.date, startTime: s.endTime }) : 0
  const durasiMenit = selesai > mulai ? Math.round((selesai - mulai) / 60_000) : 120
  const tepat = mulai + a.toleransiMenit * 60_000
  const menitJatah = a.batasJatahMenit ?? Math.floor(durasiMenit / 2)
  return { mulai, tepat, batasJatah: Math.max(tepat, mulai + menitJatah * 60_000) }
}

export type StatusDatang = 'tepat' | 'jatah' | 'lewat-batas' | 'tanpa-alasan' | 'tanpa-bukti' | 'putusan-sah' | 'putusan-tidak-sah'

/**
 * Penilaian jam datang satu catatan hadir. `null` = jam datang tidak dicatat
 * (dianggap tepat waktu). `jatah` = boleh memakai jatah telat bila masih ada.
 */
export function statusDatang(
  r: Pick<AttendanceRecord, 'status' | 'datangAt' | 'alasanTelat' | 'bukti' | 'putusanIzin'>,
  s: Pick<Session, 'date' | 'startTime' | 'endTime'>,
  a: Pick<AturanLengkap, 'toleransiMenit' | 'batasJatahMenit' | 'wajibBukti'>,
): StatusDatang | null {
  if (r.status !== 'hadir' || r.datangAt == null) return null
  const j = jendelaDatang(s, a)
  if (r.datangAt <= j.tepat) return 'tepat'
  if (r.putusanIzin === 'sah') return 'putusan-sah'
  if (r.putusanIzin === 'tidak-sah') return 'putusan-tidak-sah'
  if (r.datangAt > j.batasJatah) return 'lewat-batas'
  if (!r.alasanTelat?.trim()) return 'tanpa-alasan'
  if (a.wajibBukti && !adaBukti(r)) return 'tanpa-bukti'
  return 'jatah'
}

export const LABEL_DATANG: Record<StatusDatang, string> = {
  tepat: 'tepat waktu',
  jatah: 'telat berjatah',
  'lewat-batas': 'lewat batas jatah',
  'tanpa-alasan': 'telat tanpa alasan',
  'tanpa-bukti': 'telat tanpa bukti',
  'putusan-sah': 'telat · putusan: dihitung hadir',
  'putusan-tidak-sah': 'telat · putusan: tidak dihitung',
}

/** Sesi ini memakai Google Form presensi? (ada isian yang sudah diimpor) */
export function sesiBerForm(s: Pick<Session, 'formPresensi'>): boolean {
  return !!s.formPresensi && Object.keys(s.formPresensi).length > 0
}

/**
 * Kode satu sesi untuk satu anak — **tanpa** memperhitungkan sisa jatah telat
 * (`telat-jatah` = berhak memakai jatah; `nilaiPeserta` menurunkannya ke
 * `telat` bila jatahnya sudah habis).
 *
 * Wajib Form hanya berlaku di sesi yang isian Form-nya sudah diimpor —
 * sesi tanpa impor tidak menghukum siapa pun.
 */
export function kodeKehadiran(
  r: AttendanceRecord | undefined,
  s: Session,
  aturan: AturanLengkap,
  hariIni: string,
): KodeKehadiran {
  if (!r) return s.date < hariIni ? 'kosong' : 'mendatang'
  if (r.status === 'alpha') return 'alpha'
  if (r.status === 'hadir') {
    if (aturan.wajibForm && r.putusanIzin !== 'sah' && sesiBerForm(s) && !s.formPresensi![r.memberId]) return 'tanpa-form'
    const d = statusDatang(r, s, aturan)
    if (d == null || d === 'tepat' || d === 'putusan-sah') return 'hadir'
    return d === 'jatah' ? 'telat-jatah' : 'telat'
  }
  const k = keabsahanIzin(r, s, aturan)
  if (k === 'sah') return r.status === 'izin' ? 'izin-sah' : 'sakit-sah'
  if (k === 'tanpa-cap') return 'tanpa-cap'
  if (k === 'tanpa-bukti') return 'tanpa-bukti'
  if (k === 'ditolak') return 'izin-ditolak'
  return r.status === 'izin' ? 'izin-telat' : 'sakit-telat'
}

/* ============================ syarat pelantikan ============================ */

export type StatusPelantikan = 'lulus' | 'berjalan' | 'kritis' | 'susulan' | 'belum-mulai'

export const LABEL_STATUS: Record<StatusPelantikan, string> = {
  lulus: 'Memenuhi',
  berjalan: 'Berjalan',
  kritis: 'Kritis',
  susulan: 'Susulan',
  'belum-mulai': 'Belum mulai',
}

export const WARNA_STATUS: Record<StatusPelantikan, string> = {
  lulus: '#10b981',
  berjalan: '#3b82f6',
  kritis: '#f59e0b',
  susulan: '#e11d48',
  'belum-mulai': '#94a3b8',
}

export interface NilaiPeserta {
  memberId: string
  bergabung: string
  terlambatGabung: boolean
  /** N — sesi wajib yang berlaku (sejak tanggal bergabung). */
  wajib: number
  /** Hadir yang dihitung (tepat waktu + telat berjatah). */
  hadir: number
  /** Telat yang memakai jatah (sudah termasuk `hadir`). */
  telatJatah: number
  /** Telat yang tidak dihitung hadir (tanpa alasan/bukti, lewat batas, atau jatah habis). */
  telat: number
  /** Datang tapi tidak mengisi Google Form presensi. */
  tanpaForm: number
  izinSah: number
  sakitSah: number
  /** Izin/sakit tidak sah: terlambat lapor, tanpa jam lapor, tanpa bukti, ditolak. */
  tidakSah: number
  alpha: number
  /** Total alpa = telat + tanpaForm + tidakSah + alpha. */
  alpa: number
  kosong: number
  sisa: number
  /** Batas dari N: hadir minimal, alpa maksimal, jatah telat. */
  butuh: number
  maksAlpa: number
  maksTelat: number
  sisaAlpa: number
  sisaTelat: number
  maksHadir: number
  /** Berapa kali lagi boleh alpa tanpa gagal (min. sisa jatah alpa & kelonggaran hadir). */
  jatah: number
  persenHadir: number
  status: StatusPelantikan
  alasan: string
  /** Kode per sesi wajib program (urut tanggal); `null` = sebelum bergabung. */
  rincian: (KodeKehadiran | null)[]
}

const tglPendek = (iso: string) => {
  const [, m, d] = iso.split('-').map(Number)
  const bln = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][m - 1] ?? ''
  return `${d} ${bln}`
}

/** Sesi wajib program yang masih ada, urut tanggal & jam. */
export function sesiWajib(p: ProgramLatihan, semua: Session[]): Session[] {
  const ids = new Set(p.wajibIds)
  return semua.filter((s) => ids.has(s.id)).sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))
}

export function nilaiPeserta(
  p: ProgramLatihan,
  peserta: PesertaProgram,
  wajibUrut: Session[],
  catatan: Map<string, AttendanceRecord>,
  hariIni: string,
): NilaiPeserta {
  const a = lengkapiAturan(p.aturan)
  const terlambat = !!a.batasGabung && peserta.bergabung > a.batasGabung
  const berlaku = wajibUrut.filter((s) => s.date >= peserta.bergabung)
  const batas = batasRasio(berlaku.length, a)
  const n = { hadir: 0, telatJatah: 0, telat: 0, tanpaForm: 0, izinSah: 0, sakitSah: 0, tidakSah: 0, alpha: 0, kosong: 0, sisa: 0, wajib: 0 }
  const rincian: (KodeKehadiran | null)[] = []
  for (const s of wajibUrut) {
    if (s.date < peserta.bergabung) {
      rincian.push(null)
      continue
    }
    n.wajib++
    let k = kodeKehadiran(catatan.get(`${s.id}|${peserta.memberId}`), s, a, hariIni)
    // Jatah telat dipakai urut tanggal; sesudah habis, telat beralasan pun tidak dihitung.
    if (k === 'telat-jatah') {
      if (n.telatJatah < batas.telat) n.telatJatah++
      else k = 'telat'
    }
    rincian.push(k)
    if (k === 'hadir' || k === 'telat-jatah') n.hadir++
    else if (k === 'telat') n.telat++
    else if (k === 'tanpa-form') n.tanpaForm++
    else if (k === 'izin-sah') n.izinSah++
    else if (k === 'sakit-sah') n.sakitSah++
    else if (k === 'alpha') n.alpha++
    else if (k === 'kosong') n.kosong++
    else if (k === 'mendatang') n.sisa++
    else n.tidakSah++
  }
  const alpa = n.telat + n.tanpaForm + n.tidakSah + n.alpha
  const butuh = batas.hadir
  const maksHadir = n.hadir + n.sisa
  const longgar = Math.max(0, maksHadir - butuh)
  const sisaAlpa = Math.max(0, batas.alpa - alpa)
  const sisaTelat = Math.max(0, batas.telat - n.telatJatah)
  const jatah = Math.min(longgar, sisaAlpa)
  const sudah = n.wajib - n.sisa
  const persenHadir = sudah > 0 ? Math.round((n.hadir / sudah) * 100) : 0
  let status: StatusPelantikan
  let alasan: string
  if (terlambat) {
    status = 'susulan'
    alasan = `Bergabung ${tglPendek(peserta.bergabung)}, sesudah batas ${tglPendek(a.batasGabung!)}`
  } else if (n.wajib === 0) {
    status = 'belum-mulai'
    alasan = 'Belum ada sesi wajib sejak bergabung'
  } else if (alpa > batas.alpa) {
    status = 'susulan'
    alasan = `Alpa ${alpa}×, melebihi batas ${batas.alpa}× (${teksRasio(a.rasioAlpa)} dari ${n.wajib} sesi)`
  } else if (maksHadir < butuh) {
    status = 'susulan'
    alasan = `Paling banyak hadir ${maksHadir} dari ${butuh} yang dibutuhkan`
  } else if (n.hadir >= butuh) {
    status = 'lulus'
    alasan = `Hadir ${n.hadir} dari ${butuh} yang dibutuhkan${n.sisa > 0 ? ` · jaga alpa: sisa ${sisaAlpa}×` : ''}`
  } else if (longgar === 0) {
    status = 'kritis'
    alasan = `Wajib hadir di ${n.sisa} sesi tersisa (perlu ${butuh - n.hadir} lagi)`
  } else if (sisaAlpa === 0) {
    status = 'kritis'
    alasan = `Jatah alpa habis — perlu ${butuh - n.hadir} hadir lagi; tidak hadir hanya boleh dengan izin sah (${longgar}×)`
  } else {
    status = 'berjalan'
    alasan = `Perlu ${butuh - n.hadir} hadir lagi dari ${n.sisa} sesi · boleh tidak hadir ${longgar}× (alpa maks. ${sisaAlpa}×)`
  }
  return {
    memberId: peserta.memberId,
    bergabung: peserta.bergabung,
    terlambatGabung: terlambat,
    ...n,
    alpa,
    butuh,
    maksAlpa: batas.alpa,
    maksTelat: batas.telat,
    sisaAlpa,
    sisaTelat,
    maksHadir,
    jatah,
    persenHadir,
    status,
    alasan,
    rincian,
  }
}

export interface RekapPelantikan {
  wajib: Session[]
  baris: (NilaiPeserta & { anggota: Member | null })[]
  jumlah: Record<StatusPelantikan, number>
  /** Catatan izin/sakit wajib yang belum punya jam lapor. */
  tanpaCap: number
  /** Catatan izin/sakit wajib yang buktinya belum diterima. */
  tanpaBukti: number
  /** Sel sesi wajib yang sudah lewat tapi belum diisi. */
  kosong: number
  /** Sesi wajib yang isian Google Form presensinya sudah diimpor. */
  sesiBerForm: number
}

export function rekapPelantikan(
  p: ProgramLatihan,
  anggota: Member[],
  semua: Session[],
  catatan: AttendanceRecord[],
  hariIni: string,
): RekapPelantikan {
  const wajib = sesiWajib(p, semua)
  const ids = new Set(wajib.map((s) => s.id))
  const peta = new Map<string, AttendanceRecord>()
  for (const r of catatan) if (ids.has(r.sessionId)) peta.set(`${r.sessionId}|${r.memberId}`, r)
  const perId = new Map(anggota.map((m) => [m.id, m]))
  const baris = p.peserta.map((x) => ({ ...nilaiPeserta(p, x, wajib, peta, hariIni), anggota: perId.get(x.memberId) ?? null }))
  const jumlah: Record<StatusPelantikan, number> = { lulus: 0, berjalan: 0, kritis: 0, susulan: 0, 'belum-mulai': 0 }
  let tanpaCap = 0
  let tanpaBukti = 0
  let kosong = 0
  for (const b of baris) {
    jumlah[b.status]++
    for (const k of b.rincian) {
      if (k === 'tanpa-cap') tanpaCap++
      else if (k === 'tanpa-bukti') tanpaBukti++
      else if (k === 'kosong') kosong++
    }
  }
  return { wajib, baris, jumlah, tanpaCap, tanpaBukti, kosong, sesiBerForm: wajib.filter(sesiBerForm).length }
}

const URUT_STATUS: StatusPelantikan[] = ['susulan', 'kritis', 'berjalan', 'belum-mulai', 'lulus']

/** Urutkan: yang paling perlu perhatian dulu, lalu jatah tersedikit, lalu nama. */
export function urutkanRekap<T extends NilaiPeserta & { anggota: Member | null }>(baris: T[]): T[] {
  return [...baris].sort(
    (a, b) =>
      URUT_STATUS.indexOf(a.status) - URUT_STATUS.indexOf(b.status) ||
      a.jatah - b.jatah ||
      (a.anggota?.name ?? '').localeCompare(b.anggota?.name ?? '', 'id'),
  )
}

/** Kalimat aturan untuk layar & cetak: "hadir ≥ 7/12 · alpa ≤ 1/4 · telat ≤ 1/6 → N=12: 7 · 3 · 2". */
export function ringkasAturan(a: AturanLengkap, n: number): string {
  const b = batasRasio(n, a)
  return `hadir ≥ ${teksRasio(a.rasioHadir)}, alpa ≤ ${teksRasio(a.rasioAlpa)}, telat berjatah ≤ ${teksRasio(a.rasioTelat)} dari N sesi wajib · N = ${n} → hadir min. ${b.hadir}, alpa maks. ${b.alpa}, jatah telat ${b.telat}`
}

/* ================================ peserta ================================ */

/**
 * Tambah peserta (unik) dengan tanggal bergabung bawaan = mulai program.
 * Peserta yang sudah ada tidak diubah.
 */
export function tambahPeserta(p: ProgramLatihan, memberIds: string[], bergabung?: string): PesertaProgram[] {
  const ada = new Set(p.peserta.map((x) => x.memberId))
  const baru = memberIds.filter((id) => !ada.has(id)).map((memberId) => ({ memberId, bergabung: bergabung || p.mulai }))
  return [...p.peserta, ...baru]
}

/* ================================ CSV ================================ */

export function barisCsvPelantikan(
  r: RekapPelantikan,
  label: (section: string) => string,
): (string | number)[][] {
  const kepala = [
    'Kode',
    'Nama',
    'Section',
    'Bergabung',
    'Status',
    'Sesi wajib (N)',
    'Hadir',
    'Dibutuhkan',
    'Telat berjatah',
    'Jatah telat',
    'Alpa',
    'Alpa maks.',
    'Izin sah',
    'Sakit sah',
    'Telat tak dihitung',
    'Tanpa Form',
    'Izin/sakit tidak sah',
    'Tanpa keterangan',
    'Belum diisi',
    'Sisa sesi',
    'Keterangan',
    ...r.wajib.map((s) => s.date),
  ]
  return [
    kepala,
    ...urutkanRekap(r.baris).map((b) => [
      b.anggota?.code ?? '',
      b.anggota?.name ?? '(anggota terhapus)',
      b.anggota ? label(b.anggota.section) : '',
      b.bergabung,
      LABEL_STATUS[b.status],
      b.wajib,
      b.hadir,
      b.butuh,
      b.telatJatah,
      b.maksTelat,
      b.alpa,
      b.maksAlpa,
      b.izinSah,
      b.sakitSah,
      b.telat,
      b.tanpaForm,
      b.tidakSah,
      b.alpha,
      b.kosong,
      b.sisa,
      b.alasan,
      ...b.rincian.map((k) => (k == null ? '—' : SINGKAT_KODE[k])),
    ]),
  ]
}

/* ============================ integrasi Jadwal ============================ */

/**
 * Target neraca untuk satu minggu: target fase program yang memuat hari
 * Kamis minggu itu (tengah minggu), kalau ada; selain itu target tim.
 */
export function targetMinggu(
  program: ProgramLatihan[] | undefined,
  awal: string,
  global: TargetNeraca | null | undefined,
): { target: TargetNeraca | null; asal: string | null } {
  const tengah = tambahHari(awal, 3)
  for (const p of program ?? []) {
    const f = faseUntuk(p, tengah) ?? faseUntuk(p, awal) ?? faseUntuk(p, tambahHari(awal, 6))
    if (f?.target) return { target: f.target, asal: `${f.nama} · ${p.nama}` }
  }
  return { target: global ?? null, asal: null }
}

/** Fase & status wajib sebuah sesi menurut program yang memuatnya. */
export function infoSesiProgram(
  program: ProgramLatihan[] | undefined,
  s: Pick<Session, 'id' | 'date'>,
): { program: ProgramLatihan; fase: FaseProgram | null; wajib: boolean; urutWajib: number } | null {
  for (const p of program ?? []) {
    if (!p.sesiIds.includes(s.id)) continue
    const i = p.wajibIds.indexOf(s.id)
    return { program: p, fase: faseUntuk(p, s.date), wajib: i >= 0, urutWajib: i + 1 }
  }
  return null
}

/** Aturan pelantikan yang berlaku untuk sebuah sesi (program pemiliknya atau baku). */
export function aturanUntukSesi(program: ProgramLatihan[] | undefined, sessionId: string): AturanLengkap {
  return lengkapiAturan((program ?? []).find((p) => p.sesiIds.includes(sessionId))?.aturan)
}
