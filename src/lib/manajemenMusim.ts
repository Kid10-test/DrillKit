/**
 * #34a — Musim TC: hitung mundur H-Minus & gerbang kesiapan mundur.
 *
 * Pelatih cukup menetapkan tanggal kejuaraan utama (H-0); gerbang bawaan
 * (H-90 skor musik lengkap … H-3 pak truk) dibangkitkan mundur dari situ.
 * Tiap gerbang membaca **bukti otomatis** dari data yang sudah ada —
 * partitur lagu, Kemajuan set (K3), simulasi juri (#20), inventaris &
 * manifes truk (#18) — dan pelatih tetap bisa menandainya tercapai sendiri.
 *
 * `titikHMinus` menyatukan semua hitung mundur di satu daftar: tonggak
 * Program Latsar (#36: Hakrab, Pelantikan, Camp), H-0 & gerbang musim, dan
 * sesi penampilan di Jadwal — tidak ada sistem hitung mundur kedua.
 *
 * Modul murni (tanpa Dexie) supaya bisa diuji tanpa peramban.
 */
import type {
  Drill,
  DrillSet,
  GerbangMusim,
  ItemInventaris,
  JenisGerbangMusim,
  Kemajuan,
  ManifesLogistikLomba,
  Member,
  MusimTc,
  PenilaianLomba,
  ProgramLatihan,
  Session,
  SetList,
  Song,
} from '../db/types'
import { selisihHari, tambahHari } from './kalender'
import { hitungRekapPenilaian } from './penilaianJuri'
import { ringkasInventaris, ringkasManifesLogistik } from './inventarisLogistik'
import { setSelesai } from './kemajuan'

/* ================================ gerbang ================================ */

export const GERBANG_BAKU: Omit<GerbangMusim, 'id'>[] = [
  { hMinus: 90, nama: 'Skor musik lengkap', jenis: 'musik' },
  { hMinus: 60, nama: 'Seluruh drill terpasang', jenis: 'drill' },
  { hMinus: 30, nama: 'Full-run tanpa henti', jenis: 'fullrun' },
  { hMinus: 30, nama: 'Seragam & properti siap', jenis: 'perlengkapan' },
  { hMinus: 14, nama: 'Simulasi juri Box 4+', jenis: 'juri' },
  { hMinus: 3, nama: 'Pak truk & karantina', jenis: 'logistik' },
]

export const LABEL_JENIS_GERBANG: Record<JenisGerbangMusim, string> = {
  musik: 'Musik (partitur)',
  drill: 'Drill (Kemajuan set)',
  fullrun: 'Full-run',
  perlengkapan: 'Seragam & properti',
  juri: 'Simulasi juri',
  logistik: 'Manifes truk',
  lain: 'Lainnya (manual)',
}

export function musimBaru(buatId: (awalan: string) => string, tanggalH0: string, nama = 'Kejuaraan utama', sekarang = Date.now()): MusimTc {
  return {
    id: buatId('musim_'),
    nama,
    tanggalH0,
    gerbang: GERBANG_BAKU.map((g) => ({ ...g, id: buatId('gb_') })),
    dibuat: sekarang,
    diubah: sekarang,
  }
}

export function periksaMusim(m: MusimTc): string[] {
  const out: string[] = []
  if (!m.nama.trim()) out.push('Nama kejuaraan masih kosong.')
  if (!/^\d{4}-\d\d-\d\d$/.test(m.tanggalH0)) out.push('Tanggal kejuaraan (H-0) belum diisi.')
  for (const g of m.gerbang) {
    if (!g.nama.trim()) out.push('Ada gerbang tanpa nama.')
    if (!Number.isFinite(g.hMinus) || g.hMinus < 0) out.push(`${g.nama || 'Gerbang'}: H-minus harus 0 atau lebih.`)
  }
  return out
}

/** Urutan gerbang: paling jauh dari H-0 dulu (H-90 → H-3). */
export function urutkanGerbang(gerbang: GerbangMusim[]): GerbangMusim[] {
  return [...gerbang].sort((a, b) => b.hMinus - a.hMinus || a.nama.localeCompare(b.nama, 'id'))
}

export const tanggalGerbang = (m: Pick<MusimTc, 'tanggalH0'>, g: Pick<GerbangMusim, 'hMinus'>): string => tambahHari(m.tanggalH0, -g.hMinus)

/** "H-12", "H-0", "H+3" dari sisa hari menuju tanggal acara. */
export function labelH(sisa: number): string {
  if (sisa > 0) return `H-${sisa}`
  if (sisa === 0) return 'H-0'
  return `H+${-sisa}`
}

/** "hari ini", "besok", "12 hari lagi", "3 hari lalu". */
export function teksSisa(sisa: number): string {
  if (sisa === 0) return 'hari ini'
  if (sisa === 1) return 'besok'
  if (sisa > 1) return `${sisa} hari lagi`
  if (sisa === -1) return 'kemarin'
  return `${-sisa} hari lalu`
}

/* ============================= bukti otomatis ============================= */

export interface DataBuktiMusim {
  songs: Song[]
  setlists: SetList[]
  sessions: Session[]
  drills: Drill[]
  sets: DrillSet[]
  members: Member[]
  kemajuan: Kemajuan[]
  penilaian: PenilaianLomba[]
  inventaris: ItemInventaris[]
  manifes: ManifesLogistikLomba[]
  hariIni: string
}

/** `ok`: true = terbukti tercapai, false = belum, null = tidak bisa dibaca (tandai sendiri). */
export interface BuktiGerbang {
  ok: boolean | null
  teks: string
}

/** Lagu yang dipersiapkan: set list sesi H-0 bila ada, selain itu semua lagu. */
export function laguMusim(m: MusimTc, d: Pick<DataBuktiMusim, 'songs' | 'setlists' | 'sessions'>): Song[] {
  const sesi = m.sessionId ? d.sessions.find((s) => s.id === m.sessionId) : undefined
  const sl = sesi?.setListId ? d.setlists.find((x) => x.id === sesi.setListId) : undefined
  if (sl) return sl.songIds.map((id) => d.songs.find((s) => s.id === id)).filter((s): s is Song => !!s)
  return d.songs
}

export function buktiGerbang(m: MusimTc, g: GerbangMusim, d: DataBuktiMusim): BuktiGerbang {
  switch (g.jenis) {
    case 'musik': {
      const lagu = laguMusim(m, d)
      if (!lagu.length) return { ok: false, teks: 'Belum ada lagu di repertoar' }
      const ada = lagu.filter((s) => !!s.partitur).length
      return { ok: ada === lagu.length, teks: `${ada}/${lagu.length} lagu sudah berpartitur` }
    }
    case 'drill': {
      const drill = m.drillId ? d.drills.find((x) => x.id === m.drillId) : undefined
      if (!drill) return { ok: null, teks: 'Pilih drill show agar Kemajuan set terbaca' }
      const setIds = d.sets
        .filter((s) => s.drillId === drill.id)
        .sort((a, b) => a.order - b.order)
        .map((s) => s.id)
      if (!setIds.length) return { ok: false, teks: 'Drill belum punya set' }
      const roster = new Set(drill.rosterIds ?? [])
      const seksi = [...new Set(d.members.filter((x) => roster.has(x.id)).map((x) => x.section))]
      const k = d.kemajuan.find((x) => x.key === drill.id)
      const selesai = setIds.filter((id) => setSelesai(k, id, seksi)).length
      return { ok: selesai === setIds.length, teks: `${selesai}/${setIds.length} set sudah dilatih (Kemajuan)` }
    }
    case 'perlengkapan': {
      const r = ringkasInventaris(d.inventaris)
      if (!r.total) return { ok: null, teks: 'Inventaris belum dicatat — tandai sendiri' }
      const masalah = r.perluServis + r.rusak
      return {
        ok: masalah === 0,
        teks: masalah ? `${masalah} aset perlu servis/rusak` : `${r.total} aset siap pakai`,
      }
    }
    case 'juri': {
      const kandidat = d.penilaian
        .filter((p) => p.tanggal <= d.hariIni && (!m.drillId || !p.drillId || p.drillId === m.drillId))
        .sort((a, b) => (a.tanggal < b.tanggal ? 1 : a.tanggal > b.tanggal ? -1 : b.updatedAt - a.updatedAt))
      const p = kandidat[0]
      if (!p) return { ok: false, teks: 'Belum ada simulasi juri' }
      const r = hitungRekapPenilaian(p)
      return { ok: r.persenAkhir >= 80, teks: `Simulasi ${tglPendek(p.tanggal)}: ${r.predikatBox} (${Math.round(r.persenAkhir)}%)` }
    }
    case 'logistik': {
      const mulai = tambahHari(m.tanggalH0, -7)
      const man = d.manifes
        .filter((x) => (m.sessionId && x.sessionId === m.sessionId) || (x.tanggal >= mulai && x.tanggal <= m.tanggalH0))
        .sort((a, b) => b.updatedAt - a.updatedAt)[0]
      if (!man) return { ok: false, teks: 'Belum ada manifes truk untuk hari H' }
      const r = ringkasManifesLogistik(man)
      if (!r.totalButir) return { ok: false, teks: 'Manifes truk masih kosong' }
      return { ok: r.sudahBerangkat === r.totalButir, teks: `${r.sudahBerangkat}/${r.totalButir} barang sudah dimuat` }
    }
    case 'fullrun':
      return { ok: null, teks: 'Tandai sendiri setelah full-run tanpa henti' }
    default:
      return { ok: null, teks: 'Tandai sendiri bila sudah tercapai' }
  }
}

/* ============================== status gerbang ============================== */

export type StatusGerbang = 'tercapai' | 'terlambat' | 'dekat' | 'nanti'

export const LABEL_STATUS_GERBANG: Record<StatusGerbang, string> = {
  tercapai: 'Tercapai',
  terlambat: 'Lewat tenggat',
  dekat: 'Segera',
  nanti: 'Belum waktunya',
}

/** Hex murni (layar & cetak): hijau / merah / kuning / abu. */
export const WARNA_STATUS_GERBANG: Record<StatusGerbang, string> = {
  tercapai: '#16a34a',
  terlambat: '#dc2626',
  dekat: '#d97706',
  nanti: '#64748b',
}

/** Gerbang dianggap "segera" bila tenggatnya ≤ 7 hari lagi. */
export const AMBANG_SEGERA = 7

export function statusGerbang(g: Pick<GerbangMusim, 'tercapaiAt'>, tanggal: string, bukti: BuktiGerbang, hariIni: string): StatusGerbang {
  if (g.tercapaiAt || bukti.ok === true) return 'tercapai'
  const sisa = selisihHari(hariIni, tanggal)
  if (sisa < 0) return 'terlambat'
  if (sisa <= AMBANG_SEGERA) return 'dekat'
  return 'nanti'
}

export interface BarisGerbang {
  gerbang: GerbangMusim
  tanggal: string
  sisa: number
  bukti: BuktiGerbang
  status: StatusGerbang
  /** true bila tercapai karena ditandai pelatih (bukan bukti otomatis). */
  manual: boolean
}

export interface RingkasMusim {
  musim: MusimTc
  sisaH0: number
  baris: BarisGerbang[]
  jumlah: Record<StatusGerbang, number>
}

export function ringkasMusim(m: MusimTc, d: DataBuktiMusim): RingkasMusim {
  const jumlah: Record<StatusGerbang, number> = { tercapai: 0, terlambat: 0, dekat: 0, nanti: 0 }
  const baris = urutkanGerbang(m.gerbang).map((g) => {
    const tanggal = tanggalGerbang(m, g)
    const bukti = buktiGerbang(m, g, d)
    const status = statusGerbang(g, tanggal, bukti, d.hariIni)
    jumlah[status]++
    return { gerbang: g, tanggal, sisa: selisihHari(d.hariIni, tanggal), bukti, status, manual: !!g.tercapaiAt && bukti.ok !== true }
  })
  return { musim: m, sisaH0: selisihHari(d.hariIni, m.tanggalH0), baris, jumlah }
}

/** Musim yang sedang dikejar: H-0 terdekat yang belum lewat, selain itu yang terakhir. */
export function musimAktif(daftar: MusimTc[] | undefined, hariIni: string): MusimTc | null {
  const xs = [...(daftar ?? [])].sort((a, b) => a.tanggalH0.localeCompare(b.tanggalH0))
  return xs.find((m) => m.tanggalH0 >= hariIni) ?? xs[xs.length - 1] ?? null
}

/* ============================ titik hitung mundur ============================ */

export type AsalTitik = 'program' | 'musim' | 'gerbang' | 'jadwal'

export interface TitikHMinus {
  id: string
  /** Kosong = tanggal belum ditentukan (mis. camp). */
  tanggal: string
  nama: string
  asal: AsalTitik
  /** null bila tanggal belum ditentukan. */
  sisa: number | null
  keterangan?: string
  status?: StatusGerbang
}

const TONGGAK_HITUNG = new Set(['acara', 'tes', 'pelantikan', 'camp'])

/**
 * Semua hitung mundur dalam satu daftar, terurut tanggal (tanpa tanggal di
 * akhir): tonggak Program Latsar, H-0 musim + gerbang yang belum tercapai,
 * dan sesi penampilan Jadwal yang tidak sudah terwakili.
 */
export function titikHMinus(opsi: {
  program?: ProgramLatihan[]
  ringkas?: RingkasMusim[]
  sessions: Session[]
  hariIni: string
  /** Hanya titik dalam N hari ke depan (bawaan 120). Gerbang terlambat selalu ikut. */
  cakrawala?: number
}): TitikHMinus[] {
  const { hariIni } = opsi
  const batas = tambahHari(hariIni, opsi.cakrawala ?? 120)
  const out: TitikHMinus[] = []
  const dikenal = new Set<string>()
  for (const p of opsi.program ?? []) {
    for (const id of p.sesiIds) dikenal.add(id)
    for (const t of p.tonggak) {
      if (!TONGGAK_HITUNG.has(t.jenis)) continue
      const akhir = t.sampai ?? t.dari
      if (!t.dari) {
        if (p.selesai >= hariIni) out.push({ id: `${p.id}|${t.id}`, tanggal: '', nama: t.nama, asal: 'program', sisa: null, keterangan: `${p.nama} · tanggal belum ditentukan` })
        continue
      }
      if (akhir! < hariIni || t.dari > batas) continue
      out.push({ id: `${p.id}|${t.id}`, tanggal: t.dari, nama: t.nama, asal: 'program', sisa: selisihHari(hariIni, t.dari), keterangan: p.nama })
    }
  }
  for (const r of opsi.ringkas ?? []) {
    const m = r.musim
    if (m.sessionId) dikenal.add(m.sessionId)
    if (m.tanggalH0 >= hariIni && m.tanggalH0 <= batas)
      out.push({ id: m.id, tanggal: m.tanggalH0, nama: m.nama, asal: 'musim', sisa: r.sisaH0, keterangan: 'Kejuaraan utama (H-0)' })
    if (m.tanggalH0 < hariIni) continue
    for (const b of r.baris) {
      if (b.status === 'tercapai') continue
      if (b.status !== 'terlambat' && b.tanggal > batas) continue
      out.push({
        id: `${m.id}|${b.gerbang.id}`,
        tanggal: b.tanggal,
        nama: b.gerbang.nama,
        asal: 'gerbang',
        sisa: b.sisa,
        keterangan: `${labelH(b.gerbang.hMinus)} ${m.nama}`,
        status: b.status,
      })
    }
  }
  for (const s of opsi.sessions) {
    if (s.type !== 'penampilan' || s.date < hariIni || s.date > batas || dikenal.has(s.id)) continue
    out.push({ id: s.id, tanggal: s.date, nama: s.title, asal: 'jadwal', sisa: selisihHari(hariIni, s.date), keterangan: 'Penampilan' })
  }
  return out.sort((a, b) => {
    if (!a.tanggal || !b.tanggal) return a.tanggal ? -1 : b.tanggal ? 1 : 0
    return a.tanggal.localeCompare(b.tanggal) || urutAsal[a.asal] - urutAsal[b.asal]
  })
}

const urutAsal: Record<AsalTitik, number> = { musim: 0, program: 1, jadwal: 2, gerbang: 3 }

export const LABEL_ASAL_TITIK: Record<AsalTitik, string> = {
  program: 'Program',
  musim: 'Kejuaraan',
  gerbang: 'Gerbang',
  jadwal: 'Jadwal',
}

function tglPendek(iso: string): string {
  const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']
  return `${Number(iso.slice(8))} ${BULAN[Number(iso.slice(5, 7)) - 1] ?? ''}`
}
