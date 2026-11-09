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
 * 2. **Keabsahan izin/sakit** — izin sah bila tertulis sebelum jam mulai
 *    sesi; sakit sah bila dilaporkan paling lambat N jam sesudah mulai;
 *    selain itu dihitung tanpa keterangan. Putusan pelatih mengalahkan jam.
 * 3. **Syarat pelantikan** — hadir ≥ ⌈persen × (wajib − izin/sakit sah)⌉ dan
 *    minimal `hadirMin` hadir fisik; bergabung setelah batas → susulan.
 *    Status dihitung **ke depan**: kapan seseorang sudah pasti lulus, masih
 *    bisa (dengan sisa jatah absen), atau sudah pasti harus susulan.
 */
import type {
  AttendanceRecord,
  AturanPelantikan,
  FaseProgram,
  Member,
  PesertaProgram,
  PolaSesi,
  ProgramLatihan,
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

export const ATURAN_BAKU: AturanPelantikan = { persenMin: 70, hadirMin: 7, sakitMaksJam: 24 }

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
    aturan: { ...ATURAN_BAKU },
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
  | 'izin-sah'
  | 'sakit-sah'
  | 'izin-telat'
  | 'sakit-telat'
  | 'tanpa-cap'
  | 'alpha'
  | 'kosong'
  | 'mendatang'

export const LABEL_KODE: Record<KodeKehadiran, string> = {
  hadir: 'Hadir',
  'izin-sah': 'Izin sah',
  'sakit-sah': 'Sakit sah',
  'izin-telat': 'Izin terlambat',
  'sakit-telat': 'Sakit terlambat',
  'tanpa-cap': 'Izin/sakit tanpa jam lapor',
  alpha: 'Tanpa keterangan',
  kosong: 'Belum diisi',
  mendatang: 'Belum berlangsung',
}

export const SINGKAT_KODE: Record<KodeKehadiran, string> = {
  hadir: 'H',
  'izin-sah': 'I',
  'sakit-sah': 'S',
  'izin-telat': 'I!',
  'sakit-telat': 'S!',
  'tanpa-cap': 'I?',
  alpha: 'A',
  kosong: '·',
  mendatang: '',
}

/** Hex untuk sel rekap (layar & cetak). */
export const WARNA_KODE: Record<KodeKehadiran, string> = {
  hadir: '#10b981',
  'izin-sah': '#0ea5e9',
  'sakit-sah': '#f59e0b',
  'izin-telat': '#f43f5e',
  'sakit-telat': '#f43f5e',
  'tanpa-cap': '#fb7185',
  alpha: '#e11d48',
  kosong: '#94a3b8',
  mendatang: '#cbd5e1',
}

/** Kode yang mengurangi pembagi (tidak mengurangi jatah). */
export const KODE_SAH: KodeKehadiran[] = ['izin-sah', 'sakit-sah']
/** Kode yang dihitung sebagai tidak hadir tanpa keterangan sah. */
export const KODE_ALPHA: KodeKehadiran[] = ['izin-telat', 'sakit-telat', 'tanpa-cap', 'alpha', 'kosong']

export type KeabsahanIzin = 'sah' | 'telat' | 'tanpa-cap'

/** Keabsahan satu catatan izin/sakit; `null` untuk hadir/alpha. */
export function keabsahanIzin(
  r: Pick<AttendanceRecord, 'status' | 'dilaporAt' | 'putusanIzin'>,
  s: Pick<Session, 'date' | 'startTime'>,
  aturan: Pick<AturanPelantikan, 'sakitMaksJam'>,
): KeabsahanIzin | null {
  if (r.status !== 'izin' && r.status !== 'sakit') return null
  if (r.putusanIzin === 'sah') return 'sah'
  if (r.putusanIzin === 'tidak-sah') return 'telat'
  if (r.dilaporAt == null) return 'tanpa-cap'
  const mulai = mulaiSesiMs(s)
  if (r.status === 'izin') return r.dilaporAt < mulai ? 'sah' : 'telat'
  return r.dilaporAt <= mulai + aturan.sakitMaksJam * 3_600_000 ? 'sah' : 'telat'
}

/** Kalimat pendek tentang batas lapor sebuah catatan — dipakai di Absensi. */
export function batasLapor(status: 'izin' | 'sakit', s: Pick<Session, 'date' | 'startTime'>, aturan: Pick<AturanPelantikan, 'sakitMaksJam'>): number {
  const mulai = mulaiSesiMs(s)
  return status === 'izin' ? mulai : mulai + aturan.sakitMaksJam * 3_600_000
}

export function kodeKehadiran(
  r: AttendanceRecord | undefined,
  s: Session,
  aturan: AturanPelantikan,
  hariIni: string,
): KodeKehadiran {
  if (!r) return s.date < hariIni ? 'kosong' : 'mendatang'
  if (r.status === 'hadir') return 'hadir'
  if (r.status === 'alpha') return 'alpha'
  const k = keabsahanIzin(r, s, aturan)
  if (k === 'sah') return r.status === 'izin' ? 'izin-sah' : 'sakit-sah'
  if (k === 'tanpa-cap') return 'tanpa-cap'
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
  /** Sesi wajib yang berlaku (sesudah tanggal bergabung). */
  wajib: number
  hadir: number
  izinSah: number
  sakitSah: number
  /** Izin/sakit tidak sah + tanpa jam lapor. */
  tidakSah: number
  alpha: number
  kosong: number
  sisa: number
  pembagi: number
  butuh: number
  maksHadir: number
  /** Sisa jatah absen (tanpa keterangan sah) sebelum gagal. */
  jatah: number
  persenHadir: number
  status: StatusPelantikan
  alasan: string
  /** Kode per sesi wajib program (urut tanggal); `null` = sebelum bergabung. */
  rincian: (KodeKehadiran | null)[]
}

export function butuhHadir(pembagi: number, aturan: Pick<AturanPelantikan, 'persenMin' | 'hadirMin'>): number {
  const persen = Math.ceil((aturan.persenMin / 100) * pembagi - 1e-9)
  return Math.max(persen, aturan.hadirMin)
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
  const a = p.aturan
  const terlambat = !!a.batasGabung && peserta.bergabung > a.batasGabung
  const n = { hadir: 0, izinSah: 0, sakitSah: 0, tidakSah: 0, alpha: 0, kosong: 0, sisa: 0, wajib: 0 }
  const rincian: (KodeKehadiran | null)[] = []
  for (const s of wajibUrut) {
    if (s.date < peserta.bergabung) {
      rincian.push(null)
      continue
    }
    n.wajib++
    const k = kodeKehadiran(catatan.get(`${s.id}|${peserta.memberId}`), s, a, hariIni)
    rincian.push(k)
    if (k === 'hadir') n.hadir++
    else if (k === 'izin-sah') n.izinSah++
    else if (k === 'sakit-sah') n.sakitSah++
    else if (k === 'izin-telat' || k === 'sakit-telat' || k === 'tanpa-cap') n.tidakSah++
    else if (k === 'alpha') n.alpha++
    else if (k === 'kosong') n.kosong++
    else n.sisa++
  }
  const pembagi = n.wajib - n.izinSah - n.sakitSah
  const butuh = butuhHadir(pembagi, a)
  const maksHadir = n.hadir + n.sisa
  const jatah = Math.max(0, maksHadir - butuh)
  const sudah = n.wajib - n.sisa
  const persenHadir = sudah - n.izinSah - n.sakitSah > 0 ? Math.round((n.hadir / (sudah - n.izinSah - n.sakitSah)) * 100) : 0
  let status: StatusPelantikan
  let alasan: string
  if (terlambat) {
    status = 'susulan'
    alasan = `Bergabung ${tglPendek(peserta.bergabung)}, sesudah batas ${tglPendek(a.batasGabung!)}`
  } else if (n.wajib === 0) {
    status = 'belum-mulai'
    alasan = 'Belum ada sesi wajib sejak bergabung'
  } else if (n.hadir >= butuh) {
    status = 'lulus'
    alasan = `Hadir ${n.hadir} dari ${butuh} yang dibutuhkan`
  } else if (maksHadir < butuh) {
    status = 'susulan'
    alasan =
      pembagi < a.hadirMin && n.hadir + n.sisa < a.hadirMin
        ? `Paling banyak hadir ${maksHadir}×, minimal ${a.hadirMin}× hadir fisik`
        : `Paling banyak hadir ${maksHadir} dari ${butuh} yang dibutuhkan`
  } else {
    status = jatah === 0 ? 'kritis' : 'berjalan'
    alasan =
      jatah === 0
        ? `Wajib hadir di ${n.sisa} sesi tersisa (perlu ${butuh - n.hadir} lagi)`
        : `Perlu ${butuh - n.hadir} hadir lagi dari ${n.sisa} sesi · boleh absen ${jatah}×`
  }
  return {
    memberId: peserta.memberId,
    bergabung: peserta.bergabung,
    terlambatGabung: terlambat,
    ...n,
    pembagi,
    butuh,
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
  for (const b of baris) {
    jumlah[b.status]++
    tanpaCap += b.rincian.filter((k) => k === 'tanpa-cap').length
  }
  return { wajib, baris, jumlah, tanpaCap }
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
    'Hadir',
    'Izin sah',
    'Sakit sah',
    'Tidak sah',
    'Tanpa keterangan',
    'Belum diisi',
    'Sisa sesi',
    'Dibutuhkan',
    'Sisa jatah absen',
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
      b.hadir,
      b.izinSah,
      b.sakitSah,
      b.tidakSah,
      b.alpha,
      b.kosong,
      b.sisa,
      b.butuh,
      b.jatah,
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
export function aturanUntukSesi(program: ProgramLatihan[] | undefined, sessionId: string): AturanPelantikan {
  return (program ?? []).find((p) => p.sesiIds.includes(sessionId))?.aturan ?? ATURAN_BAKU
}
