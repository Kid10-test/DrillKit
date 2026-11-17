/**
 * v2.13 — Putusan danlat untuk izin, sakit, telat, dan pulang awal.
 *
 * Izin adalah keputusan danlat. Aturan jam & bukti (`programLatsar.ts`) tetap
 * dipakai sebagai **usul** dan sebagai hitungan sementara selama putusan
 * belum ada; begitu danlat memutus, putusannya yang berlaku.
 *
 * Modul murni (tanpa Dexie, React, atau DOM) supaya bisa diuji di node:
 *  - `butirPutusan` / `daftarPutusan` — catatan mana yang perlu diputus,
 *    usul menurut aturan, dan keterangannya.
 *  - `teksWaPutusan` — pesan WhatsApp bernomor untuk danlat.
 *  - `bacaBalasanDanlat` — balasan "1-3 terima, 4 tolak" → putusan per nomor.
 *  - `ubahanPutusan` — field yang ditulis ke catatan absensi.
 */
import type { AttendanceRecord, Session } from '../db/types'
import {
  batasLapor,
  kategoriIzin,
  keabsahanIzin,
  pulangAwal,
  sesiBerForm,
  statusDatang,
  jendelaDatang,
  teksBatasSakit,
  type AturanLengkap,
} from './programLatsar'

export type JenisPutusan = 'izin' | 'sakit' | 'telat' | 'pulang' | 'telat-pulang' | 'tanpa-form'
export type Putusan = NonNullable<AttendanceRecord['putusanIzin']>
export type Vonis = 'terima' | 'tolak'

export interface ButirPutusan {
  r: AttendanceRecord
  jenis: JenisPutusan
  /** Hasil aturan bila tidak diputus: `terima` = sesuai aturan. */
  usul: Vonis
  /** Keterangan singkat: jam lapor/datang, kategori, bukti, sebab ditolak aturan. */
  keterangan: string[]
  alasan?: string
  /** Tautan bukti (kosong bila hanya "ada" lewat WA atau belum ada). */
  tautanBukti?: string
  adaBukti: boolean
  /** Putusan yang sudah tercatat, bila ada. */
  putusan?: Putusan
}

const dua = (n: number) => String(n).padStart(2, '0')
/** "14.05" — atau "16/11 21.40" bila bukan di hari sesi. */
export function jamLapor(ms: number, tanggalSesi: string): string {
  const d = new Date(ms)
  const iso = `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`
  const jam = `${dua(d.getHours())}.${dua(d.getMinutes())}`
  return iso === tanggalSesi ? jam : `${d.getDate()}/${d.getMonth() + 1} ${jam}`
}

const tautan = (b?: string) => (b && /^https?:\/\//i.test(b.trim()) ? b.trim() : undefined)

/**
 * Satu catatan → butir putusan, atau `null` bila tidak ada yang perlu diputus
 * (hadir tepat waktu & sudah isi Form, alpa, atau belum diisi).
 */
export function butirPutusan(r: AttendanceRecord, s: Session, aturan: AturanLengkap): ButirPutusan | null {
  const putusan = r.putusanIzin
  const dasar = { r, putusan, adaBukti: !!r.bukti?.trim(), tautanBukti: tautan(r.bukti) }
  if (r.status === 'izin' || r.status === 'sakit') {
    const k = keabsahanIzin({ ...r, putusanIzin: undefined }, s, aturan)
    const ket: string[] = []
    if (r.dilaporAt != null) {
      const batas = batasLapor(r.status, s, aturan)
      const lewat = r.status === 'izin' ? r.dilaporAt >= batas : r.dilaporAt > batas
      ket.push(`lapor ${jamLapor(r.dilaporAt, s.date)}${lewat ? `, lewat ${jamLapor(batas, s.date)}` : ''}`)
    } else ket.push('jam lapor belum ada')
    if (r.kategoriIzin) ket.push(kategoriIzin(aturan, r.kategoriIzin)?.nama ?? 'kategori di luar daftar')
    ket.push(dasar.adaBukti ? 'bukti ada' : 'tanpa bukti')
    return { ...dasar, jenis: r.status, usul: k === 'sah' ? 'terima' : 'tolak', keterangan: ket, alasan: r.note?.trim() || undefined }
  }
  if (r.status !== 'hadir') return null
  const tanpaForm = aturan.wajibForm && sesiBerForm(s) && !s.formPresensi?.[r.memberId]
  const polos = { ...r, putusanIzin: undefined }
  const d = statusDatang(polos, s, aturan)
  const telat = d != null && d !== 'tepat'
  if (!telat && !tanpaForm) return null
  const ket: string[] = []
  let jenis: JenisPutusan = 'tanpa-form'
  if (telat) {
    const j = jendelaDatang(s, aturan)
    const datangTelat = r.datangAt != null && r.datangAt > j.tepat
    const pulang = pulangAwal(r, s, aturan)
    jenis = datangTelat && pulang ? 'telat-pulang' : pulang ? 'pulang' : 'telat'
    if (datangTelat) ket.push(`datang ${jamLapor(r.datangAt!, s.date)}${r.datangAt! > j.batasJatah ? `, lewat ${jamLapor(j.batasJatah, s.date)}` : ''}`)
    if (pulang) ket.push(`pulang ${jamLapor(r.pulangAt!, s.date)}${d === 'lewat-batas' && !datangTelat ? ', waktu ikut kurang' : ''}`)
    if (d === 'lewat-batas' && datangTelat && pulang) ket.push('waktu ikut kurang')
    if (d === 'tanpa-alasan') ket.push('tanpa alasan')
    ket.push(dasar.adaBukti ? 'bukti ada' : 'tanpa bukti')
  }
  if (tanpaForm) ket.push('tidak mengisi Form')
  return {
    ...dasar,
    jenis,
    usul: d !== 'lewat-batas' && d !== 'tanpa-alasan' && d !== 'tanpa-bukti' && !tanpaForm ? 'terima' : 'tolak',
    keterangan: ket,
    alasan: r.alasanTelat?.trim() || undefined,
  }
}

const URUT_JENIS: Record<JenisPutusan, number> = { izin: 0, sakit: 1, telat: 2, pulang: 3, 'telat-pulang': 4, 'tanpa-form': 5 }

/**
 * Semua butir putusan satu sesi. Urutan tetap supaya nomor di pesan WA tidak
 * bergeser selama belum ada catatan baru: yang belum diputus dulu, lalu yang
 * sesuai aturan, lalu menurut jenis dan nama.
 */
export function daftarPutusan(
  catatan: AttendanceRecord[],
  s: Session,
  aturan: AturanLengkap,
  nama: (memberId: string) => string,
  anggotaAktif?: ReadonlySet<string>,
): ButirPutusan[] {
  const out: ButirPutusan[] = []
  for (const r of catatan) {
    if (r.sessionId !== s.id) continue
    if (anggotaAktif && !anggotaAktif.has(r.memberId)) continue
    const b = butirPutusan(r, s, aturan)
    if (b) out.push(b)
  }
  return out.sort(
    (a, b) =>
      Number(!!a.putusan) - Number(!!b.putusan) ||
      Number(a.usul === 'tolak') - Number(b.usul === 'tolak') ||
      URUT_JENIS[a.jenis] - URUT_JENIS[b.jenis] ||
      nama(a.r.memberId).localeCompare(nama(b.r.memberId), 'id'),
  )
}

/** Nilai yang ditulis untuk vonis "terima": telat/pulang memakai jatah, selainnya sah. */
export function nilaiTerima(jenis: JenisPutusan): Putusan {
  return jenis === 'telat' || jenis === 'pulang' || jenis === 'telat-pulang' ? 'jatah' : 'sah'
}

export function nilaiVonis(jenis: JenisPutusan, v: Vonis): Putusan {
  return v === 'terima' ? nilaiTerima(jenis) : 'tidak-sah'
}

export const LABEL_JENIS: Record<JenisPutusan, string> = {
  izin: 'Izin',
  sakit: 'Sakit',
  telat: 'Telat',
  pulang: 'Pulang awal',
  'telat-pulang': 'Telat & pulang awal',
  'tanpa-form': 'Hadir tanpa Form',
}

/** Kata kerja putusan "terima" per jenis — Diizinkan / Disahkan. */
export function labelTerima(jenis: JenisPutusan): string {
  return jenis === 'izin' ? 'Diizinkan' : 'Disahkan'
}

/** Label putusan yang tercatat, mis. "Diizinkan", "Disahkan · pakai jatah", "Ditolak". */
export function labelPutusan(jenis: JenisPutusan, p: Putusan): string {
  if (p === 'tidak-sah') return 'Ditolak'
  if (p === 'jatah') return 'Disahkan · pakai jatah telat'
  if (jenis === 'izin') return 'Diizinkan'
  if (jenis === 'sakit') return 'Disahkan'
  return 'Dihitung hadir penuh'
}

/** Field yang ditulis ke catatan absensi; `null` = hapus putusan (kembali menunggu). */
export function ubahanPutusan(
  p: Putusan | null,
  oleh: string,
  sekarang: number,
  catatan?: string,
): Pick<AttendanceRecord, 'putusanIzin' | 'putusanOleh' | 'putusanAt' | 'putusanCatatan'> {
  if (!p) return { putusanIzin: undefined, putusanOleh: undefined, putusanAt: undefined, putusanCatatan: undefined }
  return { putusanIzin: p, putusanOleh: oleh.trim() || 'Danlat', putusanAt: sekarang, putusanCatatan: catatan?.trim() || undefined }
}

/* ------------------------------ pesan WhatsApp ------------------------------ */

export interface OpsiTeksWa {
  /** "P3 · Selasa, 17 November 2026" */
  judulSesi: string
  nama: (memberId: string) => string
  /** Sertakan tautan bukti (bawaan ya). */
  denganTautan?: boolean
}

/** Ringkasan aturan untuk kepala pesan: "izin ≤ 15.00 · sakit ≤ 15.30 · bukti wajib". */
export function ringkasAturan(s: Pick<Session, 'date' | 'startTime'>, a: AturanLengkap): string {
  const izin = a.batasIzin ? a.batasIzin.replace(':', '.') : (s.startTime || '').replace(':', '.')
  return [`izin ≤ ${izin}`, teksBatasSakit(a), a.wajibBukti ? 'bukti wajib' : ''].filter(Boolean).join(' · ')
}

/**
 * Pesan bernomor untuk danlat. Hanya butir yang belum diputus; nomornya
 * mengikuti urutan `butir` (pakai `daftarPutusan` lalu saring yang belum
 * diputus) — `bacaBalasanDanlat` memakai nomor yang sama.
 */
export function teksWaPutusan(butir: ButirPutusan[], s: Pick<Session, 'date' | 'startTime'>, aturan: AturanLengkap, o: OpsiTeksWa): string {
  const baris: string[] = [`*Putusan izin & telat — ${o.judulSesi}*`, `Aturan: ${ringkasAturan(s, aturan)}`]
  if (!butir.length) return [...baris, '', 'Tidak ada yang menunggu putusan.'].join('\n')
  const tulis = (b: ButirPutusan, no: number) => {
    baris.push(`${no}. ${o.nama(b.r.memberId)} — ${LABEL_JENIS[b.jenis]} · ${b.keterangan.join(' · ')}`)
    if (b.alasan) baris.push(`   Alasan: ${b.alasan}`)
    if (b.tautanBukti && o.denganTautan !== false) baris.push(`   Bukti: ${b.tautanBukti}`)
  }
  const terima = butir.map((b, i) => [b, i + 1] as const).filter(([b]) => b.usul === 'terima')
  const tolak = butir.map((b, i) => [b, i + 1] as const).filter(([b]) => b.usul === 'tolak')
  if (terima.length) {
    baris.push('', '*Sesuai aturan — usul diterima*')
    for (const [b, no] of terima) tulis(b, no)
  }
  if (tolak.length) {
    baris.push('', '*Perlu dipertimbangkan — menurut aturan ditolak*')
    for (const [b, no] of tolak) tulis(b, no)
  }
  baris.push('', 'Mohon dibalas dengan nomor, mis. "1-3 terima, 4 tolak" atau "semua terima kecuali 5".')
  return baris.join('\n')
}

/* ------------------------------ balasan danlat ------------------------------ */

const KATA_TOLAK = /(tidak\s*sah|tidak\s*diizinkan|ditolak|\btolak\b|\btidak\b|\benggak\b|\bnggak\b|\bgak\b|\bno\b|❌|✖️?|✗|👎)/iu
const KATA_TERIMA = /(diterima|terima|diizinkan|izinkan|disahkan|sahkan|\bsah\b|setuju|\bacc\b|\boke?\b|\bok\b|\bya\b|✅|✔️?|☑️?|👍)/iu

function vonisDari(teks: string): { v: Vonis; pos: number } | null {
  const t = KATA_TOLAK.exec(teks)
  const y = KATA_TERIMA.exec(teks)
  // "tidak sah" memuat "sah": kata tolak menang bila keduanya muncul di tempat yang sama.
  if (t && (!y || t.index <= y.index)) return { v: 'tolak', pos: t.index }
  if (y) return { v: 'terima', pos: y.index }
  return null
}

function angkaDari(teks: string): { nomor: number[]; pos: number } {
  const nomor: number[] = []
  let pos = -1
  for (const m of teks.matchAll(/(\d+)\s*(?:-|–|—|s\.?\s*d\.?|sampai)\s*(\d+)|(\d+)/giu)) {
    if (pos < 0) pos = m.index ?? 0
    if (m[3]) nomor.push(Number(m[3]))
    else {
      const a = Number(m[1])
      const b = Number(m[2])
      for (let i = Math.min(a, b); i <= Math.max(a, b) && i - Math.min(a, b) < 200; i++) nomor.push(i)
    }
  }
  return { nomor, pos }
}

export interface HasilBalasan {
  vonis: Map<number, Vonis>
  /** Nomor yang disebut tetapi tidak ada di daftar. */
  diLuar: number[]
  /** Nomor di daftar yang belum mendapat vonis. */
  belum: number[]
}

/**
 * Baca balasan danlat. Contoh yang dipahami: "1-3 terima, 4 tolak",
 * "terima 1, 2, 5", "1 2 3 ok; 4 ❌", "semua terima kecuali 4 dan 6".
 * Nomor tanpa kata putusan mengikuti kata putusan berikutnya ("1, 2, 3 terima")
 * atau sebelumnya ("terima 1, 2, 3").
 */
export function bacaBalasanDanlat(teks: string, jumlah: number): HasilBalasan {
  const vonis = new Map<number, Vonis>()
  const diLuar = new Set<number>()
  const beri = (ns: number[], v: Vonis) => {
    for (const n of ns) {
      if (n >= 1 && n <= jumlah) vonis.set(n, v)
      else diLuar.add(n)
    }
  }
  let tunda: number[] = []
  let bawa: Vonis | null = null
  const ruas = teks
    .replace(/\r/g, '')
    .split(/[,;\n]+|\s+dan\s+/iu)
    .map((x) => x.trim())
    .filter(Boolean)
  for (const r of ruas) {
    const semua = /\bsemua(nya)?\b|\bsisanya\b|\bselebihnya\b/iu.test(r)
    const kecuali = /\bkecuali\b/iu.exec(r)
    const v = vonisDari(kecuali ? r.slice(0, kecuali.index) : r)
    const { nomor, pos } = angkaDari(kecuali ? r.slice(kecuali.index) : r)
    if (semua && v) {
      const lawan: Vonis = v.v === 'terima' ? 'tolak' : 'terima'
      const kec = kecuali ? nomor : []
      for (let i = 1; i <= jumlah; i++) if (!vonis.has(i) && !kec.includes(i)) vonis.set(i, v.v)
      if (kec.length) {
        beri(kec, lawan)
        bawa = lawan // "… kecuali 4, 6" — nomor sesudahnya ikut pengecualian
      } else bawa = null
      tunda = []
      continue
    }
    if (!v) {
      if (bawa) beri(nomor, bawa)
      else tunda.push(...nomor)
      continue
    }
    const awalan = nomor.length > 0 && v.pos < pos
    beri([...tunda, ...nomor], v.v)
    tunda = []
    bawa = awalan ? v.v : null
  }
  const belum: number[] = []
  for (let i = 1; i <= jumlah; i++) if (!vonis.has(i)) belum.push(i)
  return { vonis, diLuar: [...diLuar].sort((a, b) => a - b), belum }
}
