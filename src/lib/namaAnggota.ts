/**
 * Satu anggota, dua nama.
 *
 * Pelatih absensi dan pelatih drill sering membuat orang yang sama dua kali,
 * dengan panggilan berbeda ("Andra Pratama" vs "Dede"). Id-nya beda, jadi
 * posisi drill menempel ke nama yang satu dan absensi ke nama yang lain.
 *
 * Modul ini murni (tanpa Dexie, React, atau DOM) supaya aturannya bisa diuji
 * di node:
 *
 * 1. **Nama panggilan** — yang tampil dipilih per perangkat. Cetakan resmi
 *    (laporan, kartu kehadiran) selalu memakai `name`, bukan fungsi di sini.
 * 2. **Pencocokan saat impor** — anggota yang tidak dikenal tidak langsung
 *    ditambahkan. Saran dari kode, section, instrumen, dan kemiripan nama.
 *    Pilihan diingat lewat `alias`, jadi impor berikutnya langsung cocok.
 * 3. **Gabungkan ganda** — semua rujukan pindah ke yang dipertahankan.
 *    Bentrokan: yang dipertahankan menang, dan bentrokannya dilaporkan.
 * 4. **Daftar induk** — arah `berkas`: id lokal berganti menjadi id milik
 *    pelatih utama, supaya kedua perangkat memakai id yang sama.
 */

import type {
  AttendanceRecord,
  CatatanSetoran,
  Drill,
  DrillSet,
  Evaluasi,
  Kemajuan,
  Member,
  MemberNote,
  MemberRole,
  RiwayatSnapshot,
} from '../db/types'
import { gabungCatatanSetoran, idCatatanSetoran } from './setoran'
import { uid } from './utils'

/* ------------------------------ Nama tampil -------------------------------- */

export type ModeNama = 'lengkap' | 'panggilan'

const KUNCI_MODE = 'drillkit.tampilanNama'
const pemirsa = new Set<(m: ModeNama) => void>()

/** Nama yang tampil di layar. Panggilan kosong selalu jatuh ke nama lengkap. */
export function namaTampil(
  m: { name: string; panggilan?: string },
  mode: ModeNama = 'lengkap',
): string {
  if (mode === 'panggilan' && m.panggilan?.trim()) return m.panggilan.trim()
  return m.name
}

/**
 * Bentuk yang ditulis paket anggota: "Andra Pratama (Dede)".
 * Tanpa panggilan, nama lengkap saja — tidak ada tanda kurung kosong.
 */
export function namaDenganPanggilan(m: { name: string; panggilan?: string }): string {
  const panggil = m.panggilan?.trim()
  if (!panggil || norm(panggil) === norm(m.name)) return m.name
  return `${m.name} (${panggil})`
}

/** Pencarian anggota menemukan nama lengkap, panggilan, dan kode. */
export function cocokCari(
  m: { name?: string; panggilan?: string; code?: string; instrument?: string },
  q: string,
  ikutInstrumen = false,
): boolean {
  const s = q.trim().toLowerCase()
  if (!s) return true
  const bidang = [m.name, m.panggilan, m.code]
  if (ikutInstrumen) bidang.push(m.instrument)
  return bidang.some((b) => (b ?? '').toLowerCase().includes(s))
}

export function bacaModeNama(): ModeNama {
  try {
    return localStorage.getItem(KUNCI_MODE) === 'panggilan' ? 'panggilan' : 'lengkap'
  } catch {
    return 'lengkap'
  }
}

export function simpanModeNama(mode: ModeNama): ModeNama {
  const berikut: ModeNama = mode === 'panggilan' ? 'panggilan' : 'lengkap'
  try {
    localStorage.setItem(KUNCI_MODE, berikut)
  } catch {
    /* tetap dipakai walau tidak tersimpan */
  }
  for (const fn of pemirsa) fn(berikut)
  return berikut
}

export function langgananModeNama(fn: (m: ModeNama) => void): () => void {
  pemirsa.add(fn)
  return () => pemirsa.delete(fn)
}

/* --------------------------------- Teks ------------------------------------ */

export function norm(s: string | undefined | null): string {
  return (s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function unik(ids: string[]): string[] {
  const out: string[] = []
  const lihat = new Set<string>()
  for (const id of ids) {
    const t = id?.trim()
    if (!t || lihat.has(t)) continue
    lihat.add(t)
    out.push(t)
  }
  return out
}

function rapikanAnggota(m: Member): Member {
  const out: Member = { ...m }
  const panggil = out.panggilan?.trim()
  if (panggil) out.panggilan = panggil
  else delete out.panggilan
  const alias = unik(out.alias ?? []).filter((a) => a !== out.id)
  if (alias.length) out.alias = alias
  else delete out.alias
  return out
}

/** 1 = sama persis, 0 = tidak mirip. Nama kosong tidak pernah "mirip". */
export function kemiripanNama(a: string | undefined, b: string | undefined): number {
  const x = norm(a)
  const y = norm(b)
  if (!x || !y) return 0
  if (x === y) return 1
  const pendek = x.length <= y.length ? x : y
  const panjang = x.length <= y.length ? y : x
  if (pendek.length >= 3 && panjang.includes(pendek)) return 0.85
  const tx = x.split(' ').filter((t) => t.length >= 3)
  const ty = new Set(y.split(' ').filter((t) => t.length >= 3))
  let iris = 0
  for (const t of tx) if (ty.has(t)) iris += 1
  if (iris) return iris / Math.max(tx.length, ty.size)
  if (x.length <= 24 && y.length <= 24) {
    const d = jarakTeks(x, y)
    return 1 - d / Math.max(x.length, y.length)
  }
  return 0
}

function jarakTeks(a: string, b: string): number {
  const baris = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let lalu = i - 1
    baris[0] = i
    for (let j = 1; j <= b.length; j++) {
      const simpan = baris[j]
      const biaya = a[i - 1] === b[j - 1] ? 0 : 1
      baris[j] = Math.min(baris[j] + 1, baris[j - 1] + 1, lalu + biaya)
      lalu = simpan
    }
  }
  return baris[b.length]
}

function miripOrang(
  a: { name?: string; panggilan?: string },
  b: { name?: string; panggilan?: string },
): number {
  return Math.max(
    kemiripanNama(a.name, b.name),
    kemiripanNama(a.name, b.panggilan),
    kemiripanNama(a.panggilan, b.name),
    kemiripanNama(a.panggilan, b.panggilan),
  )
}

/* ----------------------------- Saran ganda --------------------------------- */

export interface JejakAnggota {
  /** Id anggota yang punya catatan absensi. */
  absensi: string[]
  /** Id anggota yang punya titik di suatu set. */
  posisi: string[]
}

export interface SaranGanda {
  a: string
  b: string
  skor: number
  alasan: string[]
}

/**
 * Pasangan yang mungkin orang yang sama.
 *
 * Section yang sama saja tidak cukup — kalau itu cukup, seluruh brass
 * disarankan saling digabung. Yang memicu saran: kode chart sama, nama
 * mirip, atau data yang saling melengkapi (yang satu absensi, yang lain
 * posisi drill) ditambah sinyal lain. Hasilnya dibatasi supaya daftarnya
 * bisa dibaca.
 */
export function sarankanGanda(anggota: Member[], jejak: JejakAnggota): SaranGanda[] {
  const abs = new Set(jejak.absensi)
  const pos = new Set(jejak.posisi)
  const pasangan: SaranGanda[] = []
  for (let i = 0; i < anggota.length; i++) {
    for (let j = i + 1; j < anggota.length; j++) {
      const a = anggota[i]
      const b = anggota[j]
      if ((a.alias ?? []).includes(b.id) || (b.alias ?? []).includes(a.id)) continue
      const alasan: string[] = []
      let skor = 0
      if (norm(a.code) && norm(a.code) === norm(b.code)) {
        skor += 70
        alasan.push('kode chart sama')
      }
      if (a.section && a.section === b.section) {
        skor += 10
        alasan.push('section sama')
      }
      const mirip = miripOrang(a, b)
      if (mirip >= 0.99) {
        skor += 50
        alasan.push('nama sama')
      } else if (mirip >= 0.6) {
        skor += 30
        alasan.push('nama mirip')
      }
      const pelengkap =
        (abs.has(a.id) && !abs.has(b.id) && pos.has(b.id) && !pos.has(a.id)) ||
        (abs.has(b.id) && !abs.has(a.id) && pos.has(a.id) && !pos.has(b.id))
      if (pelengkap) {
        skor += 40
        alasan.push('yang satu punya absensi, yang lain punya posisi drill')
      }
      // Section saja (10) tidak pernah cukup. Pelengkap saja (40) cukup,
      // tetapi kalah peringkat dari pasangan yang punya sinyal tambahan.
      if (skor >= 40) pasangan.push({ a: a.id, b: b.id, skor, alasan })
    }
  }
  pasangan.sort((x, y) => y.skor - x.skor || x.a.localeCompare(y.a))
  return pasangan.slice(0, 8)
}

/* -------------------------- Tulis ulang rujukan ---------------------------- */

export function petaKunci<T>(
  rec: Record<string, T> | undefined,
  peta: Record<string, string>,
  label: string,
): { rec: Record<string, T>; bentrok: string[] } {
  if (!rec) return { rec: {}, bentrok: [] }
  const out: Record<string, T> = {}
  const asal = new Map<string, string>()
  const bentrok: string[] = []
  const entri = Object.entries(rec)
  // Yang sudah memakai id tujuan dulu, supaya dialah yang menang.
  const urut = [
    ...entri.filter(([id]) => (peta[id] ?? id) === id),
    ...entri.filter(([id]) => (peta[id] ?? id) !== id),
  ]
  for (const [id, nilai] of urut) {
    const ke = peta[id] ?? id
    if (asal.has(ke)) {
      bentrok.push(`${label}: ${id} bentrok, yang dipertahankan menang`)
      continue
    }
    out[ke] = nilai
    asal.set(ke, id)
  }
  return { rec: out, bentrok }
}

export function tulisUlangSet(
  set: DrillSet,
  peta: Record<string, string>,
): { set: DrillSet; bentrok: string[] } {
  if (!Object.keys(peta).length) return { set, bentrok: [] }
  const sentuh = (rec?: Record<string, unknown>) => !!rec && Object.keys(rec).some((k) => k in peta)
  const sentuhKelompok = Boolean(
    set.gerak?.kelompok?.some((k) => k.memberIds.some((id) => id in peta)),
  )
  const sentuhRipple = sentuh(set.gerak?.ripple?.urutan)
  if (!sentuh(set.points) && !sentuh(set.langkah) && !sentuhKelompok && !sentuhRipple) {
    return { set, bentrok: [] }
  }
  const titik = petaKunci(set.points, peta, `Titik ${set.name || set.id}`)
  const langkah = set.langkah ? petaKunci(set.langkah, peta, `Langkah ${set.name || set.id}`) : null
  const rippleBaru =
    set.gerak?.ripple && sentuhRipple
      ? petaKunci(set.gerak.ripple.urutan, peta, `Ripple ${set.name || set.id}`)
      : null
  const gerakBaru =
    (sentuhKelompok || rippleBaru) && set.gerak
      ? {
          ...set.gerak,
          ...(sentuhKelompok && set.gerak.kelompok
            ? {
                kelompok: set.gerak.kelompok.map((klp) => ({
                  ...klp,
                  memberIds: tulisUlangRoster(klp.memberIds, peta),
                })),
              }
            : {}),
          ...(rippleBaru && set.gerak.ripple
            ? {
                ripple: {
                  ...set.gerak.ripple,
                  urutan: rippleBaru.rec,
                },
              }
            : {}),
        }
      : set.gerak
  return {
    set: {
      ...set,
      points: titik.rec,
      ...(langkah ? { langkah: langkah.rec } : {}),
      ...(gerakBaru ? { gerak: gerakBaru } : {}),
    },
    bentrok: [
      ...titik.bentrok,
      ...(langkah?.bentrok ?? []),
      ...(rippleBaru?.bentrok ?? []),
    ],
  }
}

export function tulisUlangRoster(ids: string[] | undefined, peta: Record<string, string>): string[] {
  const out: string[] = []
  const lihat = new Set<string>()
  for (const id of ids ?? []) {
    const ke = peta[id] ?? id
    if (lihat.has(ke)) continue
    lihat.add(ke)
    out.push(ke)
  }
  return out
}

export function tulisUlangDrill(drill: Drill, peta: Record<string, string>): Drill {
  if (!Object.keys(peta).length) return drill
  const sentuhRoster = (drill.rosterIds ?? []).some((id) => id in peta)
  const sentuhKru = Boolean(
    drill.markers?.some((mk) => mk.kruIds?.some((id) => id in peta)),
  )
  if (!sentuhRoster && !sentuhKru) return drill
  return {
    ...drill,
    ...(sentuhRoster ? { rosterIds: tulisUlangRoster(drill.rosterIds, peta) } : {}),
    ...(sentuhKru && drill.markers
      ? {
          markers: drill.markers.map((mk) =>
            mk.kruIds?.some((id) => id in peta)
              ? { ...mk, kruIds: tulisUlangRoster(mk.kruIds, peta) }
              : mk,
          ),
        }
      : {}),
  }
}

export function tulisUlangAbsensi(
  rows: AttendanceRecord[],
  peta: Record<string, string>,
): { rows: AttendanceRecord[]; hapus: string[]; bentrok: string[] } {
  const bentrok: string[] = []
  const hapus: string[] = []
  const oleh = new Map<string, AttendanceRecord>()
  const urut = [
    ...rows.filter((r) => (peta[r.memberId] ?? r.memberId) === r.memberId),
    ...rows.filter((r) => (peta[r.memberId] ?? r.memberId) !== r.memberId),
  ]
  for (const r of urut) {
    const ke = peta[r.memberId] ?? r.memberId
    const kunci = `${r.sessionId}|${ke}`
    if (oleh.has(kunci)) {
      hapus.push(r.id)
      bentrok.push(`Absensi sesi ${r.sessionId}: catatan ${r.memberId} dilepas, yang dipertahankan menang`)
      continue
    }
    oleh.set(kunci, ke === r.memberId ? r : { ...r, memberId: ke })
  }
  return { rows: [...oleh.values()], hapus, bentrok }
}

/**
 * Absensi yang masuk tidak boleh menabrak indeks unik `[sesi+anggota]`
 * yang sudah ada di perangkat. Yang di perangkat menang.
 */
export function saringBentrokLokal(
  masuk: AttendanceRecord[],
  lokal: AttendanceRecord[],
): { tulis: AttendanceRecord[]; bentrok: string[] } {
  const kunci = new Map(lokal.map((r) => [`${r.sessionId}|${r.memberId}`, r.id]))
  const tulis: AttendanceRecord[] = []
  const bentrok: string[] = []
  for (const r of masuk) {
    const ada = kunci.get(`${r.sessionId}|${r.memberId}`)
    if (ada && ada !== r.id) {
      bentrok.push(`Absensi sesi ${r.sessionId} sudah ada — catatan dari berkas dilepas`)
      continue
    }
    tulis.push(r)
  }
  return { tulis, bentrok }
}

export function tulisUlangEvaluasi(
  rows: Evaluasi[],
  peta: Record<string, string>,
): { rows: Evaluasi[]; hapus: string[]; bentrok: string[] } {
  const bentrok: string[] = []
  const hapus: string[] = []
  const oleh = new Map<string, Evaluasi>()
  const urut = [
    ...rows.filter((r) => (peta[r.memberId] ?? r.memberId) === r.memberId),
    ...rows.filter((r) => (peta[r.memberId] ?? r.memberId) !== r.memberId),
  ]
  for (const r of urut) {
    const ke = peta[r.memberId] ?? r.memberId
    const kunci = `${r.tanggal}|${ke}`
    if (oleh.has(kunci)) {
      hapus.push(r.id)
      bentrok.push(`Evaluasi ${r.tanggal}: catatan ${r.memberId} dilepas, yang dipertahankan menang`)
      continue
    }
    oleh.set(kunci, ke === r.memberId ? r : { ...r, memberId: ke })
  }
  return { rows: [...oleh.values()], hapus, bentrok }
}

export function tulisUlangCatatan(rows: MemberNote[], peta: Record<string, string>): MemberNote[] {
  return rows.map((r) => {
    const ke = peta[r.memberId] ?? r.memberId
    return ke === r.memberId ? r : { ...r, memberId: ke }
  })
}

export function tulisUlangSetoran(
  rows: CatatanSetoran[],
  peta: Record<string, string>,
): { rows: CatatanSetoran[]; hapus: string[]; bentrok: string[] } {
  const bentrok: string[] = []
  const hapus: string[] = []
  const oleh = new Map<string, CatatanSetoran>()
  const urut = [
    ...rows.filter((r) => (peta[r.memberId] ?? r.memberId) === r.memberId),
    ...rows.filter((r) => (peta[r.memberId] ?? r.memberId) !== r.memberId),
  ]
  for (const r of urut) {
    const ke = peta[r.memberId] ?? r.memberId
    const idBaru = idCatatanSetoran(r.targetId, ke)
    if (ke !== r.memberId && r.id !== idBaru) {
      hapus.push(r.id)
    }
    const dimutakhirkan: CatatanSetoran =
      ke === r.memberId && r.id === idBaru ? r : { ...r, id: idBaru, memberId: ke }
    const ada = oleh.get(idBaru)
    if (ada) {
      const pemenang = gabungCatatanSetoran(ada, dimutakhirkan)
      oleh.set(idBaru, { ...pemenang, id: idBaru, memberId: ke })
      bentrok.push(`Setoran target ${r.targetId}: capaian digabung ke jenjang tertinggi`)
      continue
    }
    oleh.set(idBaru, dimutakhirkan)
  }
  return { rows: [...oleh.values()], hapus, bentrok }
}

export function tulisUlangKemajuan(
  k: Kemajuan,
  peta: Record<string, string>,
): { kemajuan: Kemajuan; bentrok: string[] } {
  if (!Object.keys(peta).length) return { kemajuan: k, bentrok: [] }
  const bentrok: string[] = []
  let berubah = false
  const centang: Kemajuan['centang'] = {}
  for (const [setId, isi] of Object.entries(k.centang ?? {})) {
    if (!Object.keys(isi).some((id) => id in peta)) {
      centang[setId] = isi
      continue
    }
    const h = petaKunci(isi, peta, `Kemajuan ${k.key}`)
    centang[setId] = h.rec
    bentrok.push(...h.bentrok)
    berubah = true
  }
  return { kemajuan: berubah ? { ...k, centang } : k, bentrok }
}

export function tulisUlangRiwayat(
  snap: RiwayatSnapshot,
  peta: Record<string, string>,
): { snap: RiwayatSnapshot; bentrok: string[] } {
  if (!Object.keys(peta).length) return { snap, bentrok: [] }
  const bentrok: string[] = []
  let drill = snap.isiDrill
  if ((drill.rosterIds ?? []).some((id) => id in peta)) {
    drill = { ...drill, rosterIds: tulisUlangRoster(drill.rosterIds, peta) }
  }
  let setsBerubah = false
  const isiSet = snap.isiSet.map((s) => {
    const h = tulisUlangSet(s, peta)
    if (h.set !== s) setsBerubah = true
    bentrok.push(...h.bentrok)
    return h.set
  })
  if (drill === snap.isiDrill && !setsBerubah) return { snap, bentrok }
  return { snap: { ...snap, isiDrill: drill, isiSet }, bentrok }
}

/** Bentuk longgar: backup memakai nama Inggris, berkas data memakai Indonesia. */
export interface MuatanRujukan {
  anggota?: Member[]
  members?: Member[]
  absensi?: AttendanceRecord[]
  attendance?: AttendanceRecord[]
  catatan?: MemberNote[]
  memberNotes?: MemberNote[]
  evaluasi?: Evaluasi[]
  setoran?: CatatanSetoran[]
  set?: DrillSet[]
  sets?: DrillSet[]
  drill?: Drill | Drill[]
  drills?: Drill[]
  kemajuan?: Kemajuan[]
  riwayat?: RiwayatSnapshot[]
}

export function tulisUlangMuatan<T extends MuatanRujukan>(
  data: T,
  peta: Record<string, string>,
): {
  data: T
  bentrok: string[]
  absensiHapus: string[]
  evaluasiHapus: string[]
  setoranHapus: string[]
} {
  const bentrok: string[] = []
  const absensiHapus: string[] = []
  const evaluasiHapus: string[] = []
  const setoranHapus: string[] = []
  if (!Object.keys(peta).length) {
    return { data, bentrok, absensiHapus, evaluasiHapus, setoranHapus }
  }
  const out = { ...data }

  const abs = (rows: AttendanceRecord[] | undefined) => {
    if (!rows) return undefined
    const h = tulisUlangAbsensi(rows, peta)
    bentrok.push(...h.bentrok)
    absensiHapus.push(...h.hapus)
    return h.rows
  }
  const eva = (rows: Evaluasi[] | undefined) => {
    if (!rows) return undefined
    const h = tulisUlangEvaluasi(rows, peta)
    bentrok.push(...h.bentrok)
    evaluasiHapus.push(...h.hapus)
    return h.rows
  }
  const sto = (rows: CatatanSetoran[] | undefined) => {
    if (!rows) return undefined
    const h = tulisUlangSetoran(rows, peta)
    bentrok.push(...h.bentrok)
    setoranHapus.push(...h.hapus)
    return h.rows
  }
  if (out.absensi) out.absensi = abs(out.absensi)
  if (out.attendance) out.attendance = abs(out.attendance)
  if (out.evaluasi) out.evaluasi = eva(out.evaluasi)
  if (out.setoran) out.setoran = sto(out.setoran)
  if (out.catatan) out.catatan = tulisUlangCatatan(out.catatan, peta)
  if (out.memberNotes) out.memberNotes = tulisUlangCatatan(out.memberNotes, peta)
  if (out.set) {
    out.set = out.set.map((s) => {
      const h = tulisUlangSet(s, peta)
      bentrok.push(...h.bentrok)
      return h.set
    })
  }
  if (out.sets) {
    out.sets = out.sets.map((s) => {
      const h = tulisUlangSet(s, peta)
      bentrok.push(...h.bentrok)
      return h.set
    })
  }
  if (Array.isArray(out.drill)) out.drill = out.drill.map((d) => tulisUlangDrill(d, peta))
  else if (out.drill) out.drill = tulisUlangDrill(out.drill, peta)
  if (out.drills) out.drills = out.drills.map((d) => tulisUlangDrill(d, peta))
  if (out.kemajuan) {
    out.kemajuan = out.kemajuan.map((k) => {
      const h = tulisUlangKemajuan(k, peta)
      bentrok.push(...h.bentrok)
      return h.kemajuan
    })
  }
  if (out.riwayat) {
    out.riwayat = out.riwayat.map((s) => {
      const h = tulisUlangRiwayat(s, peta)
      bentrok.push(...h.bentrok)
      return h.snap
    })
  }
  return { data: out, bentrok, absensiHapus, evaluasiHapus, setoranHapus }
}

/* ------------------------------ Pencocokan --------------------------------- */

export type ArahCocok = 'lokal' | 'berkas'

export type KeputusanCocok = { jenis: 'sama'; idLokal: string } | { jenis: 'baru' }

export interface SaranBaris {
  masuk: Pick<Member, 'id' | 'name' | 'code' | 'section' | 'instrument' | 'panggilan'>
  otomatis?: { idLokal: string; lewat: 'id' | 'alias' }
  saran: { idLokal: string; skor: number; alasan: string[] }[]
}

export interface HasilCocok {
  arah: ArahCocok
  /** Arah lokal: id berkas → id perangkat. Arah berkas: id perangkat → id berkas. */
  peta: Record<string, string>
  anggotaTulis: Member[]
  anggotaHapus: string[]
  /** Id di berkas yang sudah punya pasangan — jangan ditambah sebagai anggota baru. */
  idSudahCocok: string[]
  laporan: string[]
}

const AMBANG_SARAN = 25
const AMBANG_PRAPILIH = 80

function skorCocok(masuk: Member, lokal: Member): { skor: number; alasan: string[] } {
  let skor = 0
  const alasan: string[] = []
  if (norm(masuk.code) && norm(masuk.code) === norm(lokal.code)) {
    skor += 60
    alasan.push('kode chart sama')
  }
  if (masuk.section && masuk.section === lokal.section) {
    skor += 15
    alasan.push('section sama')
  }
  if (norm(masuk.instrument) && norm(masuk.instrument) === norm(lokal.instrument)) {
    skor += 20
    alasan.push('instrumen sama')
  }
  const mirip = miripOrang(masuk, lokal)
  if (mirip >= 0.99) {
    skor += 80
    alasan.push('nama sama')
  } else if (mirip >= 0.72) {
    skor += 45
    alasan.push('nama mirip')
  } else if (mirip >= 0.45) {
    skor += 25
    alasan.push('nama berdekatan')
  }
  return { skor, alasan }
}

export function susunSaran(masuk: Member[], lokal: Member[]): SaranBaris[] {
  const byId = new Map(lokal.map((m) => [m.id, m]))
  const byAlias = new Map<string, Member>()
  for (const m of lokal) for (const a of m.alias ?? []) if (a !== m.id) byAlias.set(a, m)

  return masuk.filter((m) => m && m.id).map((m) => {
    const ringkas = {
      id: m.id,
      name: m.name,
      code: m.code,
      section: m.section,
      instrument: m.instrument,
      panggilan: m.panggilan,
    }
    if (byId.has(m.id)) return { masuk: ringkas, otomatis: { idLokal: m.id, lewat: 'id' as const }, saran: [] }
    const lewatAlias = byAlias.get(m.id) ?? (m.alias ?? []).map((a) => byId.get(a)).find(Boolean)
    if (lewatAlias) {
      return { masuk: ringkas, otomatis: { idLokal: lewatAlias.id, lewat: 'alias' as const }, saran: [] }
    }
    const saran = lokal
      .map((l) => ({ idLokal: l.id, ...skorCocok(m, l) }))
      .filter((s) => s.skor >= AMBANG_SARAN)
      .sort((a, b) => b.skor - a.skor || a.idLokal.localeCompare(b.idLokal))
      .slice(0, 3)
    return { masuk: ringkas, saran }
  })
}

/** Ada anggota berkas yang belum dikenali, dan perangkat punya siapa yang bisa dicocokkan. */
export function perluDitanya(saran: SaranBaris[], jumlahLokal: number): boolean {
  if (jumlahLokal <= 0) return false
  return saran.some((s) => !s.otomatis)
}

export function keputusanAwal(saran: SaranBaris[]): Record<string, KeputusanCocok> {
  const out: Record<string, KeputusanCocok> = {}
  for (const b of saran) {
    if (b.otomatis) out[b.masuk.id] = { jenis: 'sama', idLokal: b.otomatis.idLokal }
    else if (b.saran[0] && b.saran[0].skor >= AMBANG_PRAPILIH) {
      out[b.masuk.id] = { jenis: 'sama', idLokal: b.saran[0].idLokal }
    } else out[b.masuk.id] = { jenis: 'baru' }
  }
  return out
}

function tempelPanggilan(lokal: Member, masuk: Member): Member {
  const alias = unik([...(lokal.alias ?? []), ...(masuk.alias ?? []), masuk.id]).filter((a) => a !== lokal.id)
  let panggilan = lokal.panggilan?.trim() || ''
  if (!panggilan && norm(masuk.name) && norm(masuk.name) !== norm(lokal.name)) panggilan = masuk.name.trim()
  if (!panggilan && masuk.panggilan?.trim() && norm(masuk.panggilan) !== norm(lokal.name)) {
    panggilan = masuk.panggilan.trim()
  }
  return rapikanAnggota({ ...lokal, panggilan: panggilan || undefined, alias })
}

function gabungRestore(file: Member, lokal: Member): Member {
  const alias = unik([...(file.alias ?? []), ...(lokal.alias ?? [])]).filter((a) => a !== file.id)
  return rapikanAnggota({
    ...file,
    token: file.token?.trim() ? file.token : lokal.token,
    panggilan: file.panggilan?.trim() || lokal.panggilan?.trim() || undefined,
    alias,
  })
}

function anggotaBaru(m: Member, tokenBaru: () => string): Member {
  return rapikanAnggota({
    ...m,
    token: m.token?.trim() ? m.token : tokenBaru(),
    active: m.active ?? 1,
    name: m.name?.trim() || 'Tanpa nama',
    code: m.code ?? '',
    section: m.section ?? 'other',
    instrument: m.instrument ?? '',
    role: m.role ?? 'member',
    joinYear: m.joinYear || new Date().getFullYear(),
    createdAt: m.createdAt || Date.now(),
  })
}

function adopsi(lokal: Member, induk: Member, tokenBaru: () => string): Member {
  const id = induk.id
  const namaLokalBeda = norm(lokal.name) && norm(lokal.name) !== norm(induk.name)
  const panggilan =
    lokal.panggilan?.trim() ||
    (namaLokalBeda ? lokal.name.trim() : '') ||
    induk.panggilan?.trim() ||
    ''
  const alias = unik([...(induk.alias ?? []), ...(lokal.alias ?? []), lokal.id]).filter((a) => a !== id)
  return rapikanAnggota({
    ...induk,
    id,
    token: lokal.token?.trim() ? lokal.token : induk.token?.trim() || tokenBaru(),
    phone: lokal.phone?.trim() ? lokal.phone : induk.phone,
    notes: lokal.notes?.trim() ? lokal.notes : induk.notes,
    panggilan: panggilan || undefined,
    alias,
    createdAt: Math.min(lokal.createdAt || Date.now(), induk.createdAt || Date.now()),
  })
}

interface Pasangan {
  masuk: Member
  lokal?: Member
  baru?: boolean
  lewat?: 'id' | 'alias' | 'pilihan'
  /** Pilihan pelatih menunjuk anggota yang sudah dipakai baris lain. */
  pilihanGagal?: boolean
}

function pasangkan(
  masuk: Member[],
  lokal: Member[],
  keputusan: Record<string, KeputusanCocok>,
): Pasangan[] {
  const byId = new Map(lokal.map((m) => [m.id, m]))
  const byAlias = new Map<string, Member>()
  for (const m of lokal) for (const a of m.alias ?? []) if (a !== m.id) byAlias.set(a, m)
  const terpakai = new Set<string>()
  const ambil = (m: Member | undefined): Member | undefined => {
    if (!m || terpakai.has(m.id)) return undefined
    terpakai.add(m.id)
    return m
  }

  return masuk.filter((m) => m && m.id).map((m) => {
    const kep = keputusan[m.id]
    if (kep?.jenis === 'baru') return { masuk: m, baru: true }
    if (kep?.jenis === 'sama') {
      const dipilih = byId.get(kep.idLokal)
      const lok = ambil(dipilih)
      if (lok) return { masuk: m, lokal: lok, lewat: lok.id === m.id ? ('id' as const) : ('pilihan' as const) }
      // Jangan diam-diam mencocokkan ke orang lain. Baris pertama yang
      // memilih anggota ini yang menang; sisanya masuk sebagai anggota baru.
      return { masuk: m, baru: true, pilihanGagal: true }
    }
    const samaId = ambil(byId.get(m.id))
    if (samaId) return { masuk: m, lokal: samaId, lewat: 'id' as const }
    const lewatAlias = ambil(byAlias.get(m.id)) ?? ambil((m.alias ?? []).map((a) => byId.get(a)).find(Boolean))
    if (lewatAlias) return { masuk: m, lokal: lewatAlias, lewat: 'alias' as const }
    return { masuk: m, baru: true }
  })
}

export function terapkanCocok(opts: {
  masuk: Member[]
  lokal: Member[]
  keputusan: Record<string, KeputusanCocok>
  arah: ArahCocok
  /**
   * `true` untuk backup & data pilihan: anggota yang id-nya sudah sama
   * ditimpa isi berkasnya (perilaku lama). Show tidak menimpa.
   */
  timpaSamaId?: boolean
  tokenBaru?: () => string
}): HasilCocok {
  const tokenBaru = opts.tokenBaru ?? (() => uid('t_'))
  const pasangan = pasangkan(opts.masuk, opts.lokal, opts.keputusan)
  const peta: Record<string, string> = {}
  const anggotaTulis: Member[] = []
  const anggotaHapus: string[] = []
  const idSudahCocok: string[] = []
  const laporan: string[] = []

  for (const p of pasangan) {
    if (p.baru || !p.lokal) {
      if (anggotaTulis.some((a) => a.id === p.masuk.id)) {
        idSudahCocok.push(p.masuk.id)
        laporan.push(`${p.masuk.name || p.masuk.id} dilewati — id-nya sudah tertulis dari baris lain`)
        continue
      }
      anggotaTulis.push(anggotaBaru(p.masuk, tokenBaru))
      laporan.push(
        p.pilihanGagal
          ? `${p.masuk.name || p.masuk.id} tidak bisa dicocokkan — anggota itu sudah dipilih baris lain, jadi masuk sebagai anggota baru`
          : `${p.masuk.name || p.masuk.id} ditambahkan sebagai anggota baru`,
      )
      continue
    }
    idSudahCocok.push(p.masuk.id)
    if (opts.arah === 'berkas') {
      const jadi = adopsi(p.lokal, p.masuk, tokenBaru)
      anggotaTulis.push(jadi)
      if (p.lokal.id !== p.masuk.id) {
        peta[p.lokal.id] = p.masuk.id
        anggotaHapus.push(p.lokal.id)
        laporan.push(`${p.lokal.name} berganti id menjadi milik daftar induk (${p.masuk.name})`)
      } else if (jadi.panggilan && jadi.panggilan !== p.masuk.panggilan) {
        laporan.push(`Panggilan ${jadi.panggilan} tetap menempel di ${p.masuk.name}`)
      }
      continue
    }
    // Arah lokal: id perangkat yang menang. Posisi dari berkas pindah ke sana.
    if (p.masuk.id !== p.lokal.id) peta[p.masuk.id] = p.lokal.id
    // Backup & data pilihan menimpa anggota yang id-nya sama, walau
    // pencocokannya datang dari pilihan pelatih (bukan jalur otomatis).
    // Show tidak menimpa — identitas di perangkat tetap.
    if (p.masuk.id === p.lokal.id && opts.timpaSamaId) {
      anggotaTulis.push(gabungRestore(p.masuk, p.lokal))
    } else {
      const tempel = tempelPanggilan(p.lokal, p.masuk)
      const berubah =
        tempel.panggilan !== p.lokal.panggilan ||
        (tempel.alias ?? []).join('|') !== (p.lokal.alias ?? []).join('|')
      if (berubah) anggotaTulis.push(tempel)
      if (p.masuk.id !== p.lokal.id) {
        laporan.push(`${p.masuk.name} dicocokkan ke ${p.lokal.name}`)
        if (tempel.panggilan && tempel.panggilan !== p.lokal.panggilan) {
          laporan.push(`Nama dari berkas disimpan sebagai panggilan: ${tempel.panggilan}`)
        }
      }
    }
  }

  return { arah: opts.arah, peta, anggotaTulis, anggotaHapus, idSudahCocok, laporan }
}

/* -------------------------------- Gabung ----------------------------------- */

export interface RencanaGabung {
  simpan: Member
  buangId: string
  absensi: AttendanceRecord[]
  absensiHapus: string[]
  evaluasi: Evaluasi[]
  evaluasiHapus: string[]
  setoran: CatatanSetoran[]
  setoranHapus: string[]
  catatan: MemberNote[]
  sets: DrillSet[]
  drills: Drill[]
  riwayat: RiwayatSnapshot[]
  kemajuan: Kemajuan[]
  bentrok: string[]
  info: string[]
  jumlah: {
    absensi: number
    evaluasi: number
    setoran: number
    catatan: number
    titik: number
    langkah: number
    roster: number
    riwayat: number
    drill: number
  }
}

function hitungRujukan(id: string, data: MuatanRujukan): RencanaGabung['jumlah'] {
  let absensi = 0
  let evaluasi = 0
  let setoran = 0
  let catatan = 0
  let titik = 0
  let langkah = 0
  let roster = 0
  let riwayat = 0
  for (const r of [...(data.absensi ?? []), ...(data.attendance ?? [])]) if (r.memberId === id) absensi += 1
  for (const r of data.evaluasi ?? []) if (r.memberId === id) evaluasi += 1
  for (const r of data.setoran ?? []) if (r.memberId === id) setoran += 1
  for (const r of [...(data.catatan ?? []), ...(data.memberNotes ?? [])]) if (r.memberId === id) catatan += 1
  const drillTitik = new Set<string>()
  for (const s of [...(data.set ?? []), ...(data.sets ?? [])]) {
    if (s.points?.[id]) {
      titik += 1
      drillTitik.add(s.drillId)
    }
    if (s.langkah?.[id]) langkah += 1
  }
  const drills = [
    ...(Array.isArray(data.drill) ? data.drill : data.drill ? [data.drill] : []),
    ...(data.drills ?? []),
  ]
  for (const d of drills) if ((d.rosterIds ?? []).includes(id)) roster += 1
  for (const s of data.riwayat ?? []) {
    const ada =
      (s.isiDrill.rosterIds ?? []).includes(id) ||
      s.isiSet.some((set) => set.points?.[id] || set.langkah?.[id])
    if (ada) riwayat += 1
  }
  return { absensi, evaluasi, setoran, catatan, titik, langkah, roster, riwayat, drill: drillTitik.size }
}

export function rencanakanGabung(opts: {
  simpan: Member
  buang: Member
  absensi: AttendanceRecord[]
  evaluasi: Evaluasi[]
  setoran?: CatatanSetoran[]
  catatan: MemberNote[]
  sets: DrillSet[]
  drills: Drill[]
  riwayat: RiwayatSnapshot[]
  kemajuan: Kemajuan[]
}): RencanaGabung | null {
  if (opts.simpan.id === opts.buang.id) return null
  const peta = { [opts.buang.id]: opts.simpan.id }
  const setoranAwal = opts.setoran ?? []
  const muatan: MuatanRujukan = {
    absensi: opts.absensi,
    evaluasi: opts.evaluasi,
    setoran: setoranAwal,
    catatan: opts.catatan,
    sets: opts.sets,
    drills: opts.drills,
    riwayat: opts.riwayat,
    kemajuan: opts.kemajuan,
  }
  const jumlah = hitungRujukan(opts.buang.id, muatan)
  const tulis = tulisUlangMuatan(muatan, peta)
  const simpan = tempelPanggilan(opts.simpan, { ...opts.buang, name: opts.buang.name })
  // tempelPanggilan memakai nama yang dibuang sebagai panggilan. Itu yang diminta.
  const info: string[] = []
  if (simpan.panggilan && simpan.panggilan !== opts.simpan.panggilan) {
    info.push(`Nama yang dibuang menjadi panggilan: ${simpan.panggilan}`)
  } else if (opts.simpan.panggilan) {
    info.push(`Panggilan yang sudah ada dipertahankan: ${opts.simpan.panggilan}`)
  }
  info.push(`Id lama dicatat sebagai alias: ${opts.buang.id}`)
  if (norm(opts.buang.code) && norm(opts.buang.code) !== norm(opts.simpan.code)) {
    info.push(`Kode chart yang dibuang (${opts.buang.code}) tidak dipakai`)
  }
  const bentrok = [...tulis.bentrok]
  if (
    opts.simpan.notes?.trim() &&
    opts.buang.notes?.trim() &&
    opts.simpan.notes.trim() !== opts.buang.notes.trim()
  ) {
    bentrok.push('Catatan profil: yang dipertahankan menang')
  }
  if (
    opts.simpan.phone?.trim() &&
    opts.buang.phone?.trim() &&
    opts.simpan.phone.trim() !== opts.buang.phone.trim()
  ) {
    bentrok.push('Nomor HP: yang dipertahankan menang')
  }
  const isi: Member = { ...simpan }
  if (!isi.phone?.trim() && opts.buang.phone?.trim()) isi.phone = opts.buang.phone
  if (!isi.notes?.trim() && opts.buang.notes?.trim()) isi.notes = opts.buang.notes
  if (!isi.instrument?.trim() && opts.buang.instrument?.trim()) isi.instrument = opts.buang.instrument

  const sets = (tulis.data.sets ?? []).filter((s, i) => s !== opts.sets[i])
  const drills = (tulis.data.drills ?? []).filter((d, i) => d !== opts.drills[i])
  const riwayat = (tulis.data.riwayat ?? []).filter((s, i) => s !== opts.riwayat[i])
  const kemajuan = (tulis.data.kemajuan ?? []).filter((k, i) => k !== opts.kemajuan[i])
  const absensiAsli = new Map(opts.absensi.map((r) => [r.id, r]))
  const evaluasiAsli = new Map(opts.evaluasi.map((r) => [r.id, r]))
  const setoranAsli = new Map(setoranAwal.map((r) => [r.id, r]))
  const catatanAsli = new Map(opts.catatan.map((r) => [r.id, r]))

  return {
    simpan: rapikanAnggota(isi),
    buangId: opts.buang.id,
    absensi: (tulis.data.absensi ?? []).filter((r) => absensiAsli.get(r.id)?.memberId !== r.memberId),
    absensiHapus: tulis.absensiHapus,
    evaluasi: (tulis.data.evaluasi ?? []).filter((r) => evaluasiAsli.get(r.id)?.memberId !== r.memberId),
    evaluasiHapus: tulis.evaluasiHapus,
    setoran: (tulis.data.setoran ?? []).filter((r) => setoranAsli.get(r.id) !== r),
    setoranHapus: tulis.setoranHapus,
    catatan: (tulis.data.catatan ?? []).filter((r) => catatanAsli.get(r.id)?.memberId !== r.memberId),
    sets,
    drills,
    riwayat,
    kemajuan,
    bentrok,
    info,
    jumlah,
  }
}

/**
 * Rencana adopsi daftar induk: id lokal yang cocok berganti menjadi id berkas,
 * dan seluruh rujukan di perangkat ikut pindah. Isi drill dari berkas tidak
 * ikut — pelatih kedua hanya mengambil daftar anggotanya.
 */
export function rencanakanInduk(opts: {
  hasil: HasilCocok
  absensi: AttendanceRecord[]
  evaluasi: Evaluasi[]
  setoran?: CatatanSetoran[]
  catatan: MemberNote[]
  sets: DrillSet[]
  drills: Drill[]
  riwayat: RiwayatSnapshot[]
  kemajuan: Kemajuan[]
}): {
  absensi: AttendanceRecord[]
  absensiHapus: string[]
  evaluasi: Evaluasi[]
  evaluasiHapus: string[]
  setoran: CatatanSetoran[]
  setoranHapus: string[]
  catatan: MemberNote[]
  sets: DrillSet[]
  drills: Drill[]
  riwayat: RiwayatSnapshot[]
  kemajuan: Kemajuan[]
  bentrok: string[]
} {
  const setoranAwal = opts.setoran ?? []
  const tulis = tulisUlangMuatan(
    {
      absensi: opts.absensi,
      evaluasi: opts.evaluasi,
      setoran: setoranAwal,
      catatan: opts.catatan,
      sets: opts.sets,
      drills: opts.drills,
      riwayat: opts.riwayat,
      kemajuan: opts.kemajuan,
    },
    opts.hasil.peta,
  )
  const bedaId = <T extends { id: string; memberId: string }>(baru: T[] | undefined, lama: T[]) => {
    const peta = new Map(lama.map((r) => [r.id, r.memberId]))
    return (baru ?? []).filter((r) => peta.get(r.id) !== r.memberId)
  }
  const setoranAsli = new Map(setoranAwal.map((r) => [r.id, r]))
  return {
    absensi: bedaId(tulis.data.absensi, opts.absensi),
    absensiHapus: tulis.absensiHapus,
    evaluasi: bedaId(tulis.data.evaluasi, opts.evaluasi),
    evaluasiHapus: tulis.evaluasiHapus,
    setoran: (tulis.data.setoran ?? []).filter((r) => setoranAsli.get(r.id) !== r),
    setoranHapus: tulis.setoranHapus,
    catatan: bedaId(tulis.data.catatan, opts.catatan),
    sets: (tulis.data.sets ?? []).filter((r, i) => r !== opts.sets[i]),
    drills: (tulis.data.drills ?? []).filter((r, i) => r !== opts.drills[i]),
    riwayat: (tulis.data.riwayat ?? []).filter((r, i) => r !== opts.riwayat[i]),
    kemajuan: (tulis.data.kemajuan ?? []).filter((r, i) => r !== opts.kemajuan[i]),
    bentrok: tulis.bentrok,
  }
}

export function anggotaDariBerkas(
  data: unknown,
): { ok: true; jenis: string; anggota: Member[] } | { ok: false; alasan: string } {
  if (!data || typeof data !== 'object') return { ok: false, alasan: 'Berkas tidak bisa dibaca.' }
  const d = data as Record<string, unknown>
  const ambil = (daftar: unknown, jenis: string) => {
    if (!Array.isArray(daftar) || !daftar.length) {
      return { ok: false as const, alasan: 'Berkas ini tidak memuat daftar anggota.' }
    }
    const anggota = daftar.filter((m): m is Member => !!m && typeof m === 'object' && typeof (m as Member).id === 'string')
    if (!anggota.length) return { ok: false as const, alasan: 'Daftar anggotanya kosong atau rusak.' }
    return { ok: true as const, jenis, anggota }
  }
  if (d.format === 'drillkit-show') return ambil(d.members, 'show')
  if (d.format === 'drillkit-data') return ambil(d.anggota, 'data')
  if (d.format === 'drillkit-backup') return ambil(d.members, 'backup')
  if (d.format === 'drillkit-share') return ambil(d.members, 'paket')
  return {
    ok: false,
    alasan: 'Bukan berkas DrillKit yang memuat anggota. Pakai berkas show, data, atau backup dari pelatih utama.',
  }
}

/* ---------------------------------- CSV ------------------------------------ */

export const JUDUL_CSV_ANGGOTA = [
  'Kode',
  'Nama',
  'Panggilan',
  'Section',
  'Instrumen',
  'Peran',
  'Tahun Masuk',
  'No. HP',
  'Status',
  'Catatan',
]

const PERAN_DARI_TEKS: Record<string, MemberRole> = {
  member: 'member',
  anggota: 'member',
  sectionleader: 'sectionLeader',
  'ketua section': 'sectionLeader',
  drummajor: 'drumMajor',
  'drum major': 'drumMajor',
  assistant: 'assistant',
  'asisten staff': 'assistant',
  asisten: 'assistant',
}

/** Parser CSV sederhana: kutip, koma di dalam nilai, dan pemisah `;`. */
export function pecahCsv(line: string): string[] {
  const out: string[] = []
  let cur = ''
  let kutip = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (kutip) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"'
          i += 1
        } else kutip = false
      } else cur += ch
    } else if (ch === '"') kutip = true
    else if (ch === ',' || ch === ';') {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

export function barisCsvAnggota(
  m: Member,
  labelSection: (id: string) => string,
  labelPeran: (role: string) => string,
): string[] {
  return [
    m.code,
    m.name,
    m.panggilan ?? '',
    labelSection(m.section),
    m.instrument,
    labelPeran(m.role),
    String(m.joinYear),
    m.phone ?? '',
    m.active ? 'Aktif' : 'Nonaktif',
    m.notes ?? '',
  ]
}

export interface BarisCsvAnggota {
  code: string
  name: string
  panggilan?: string
  section: string
  instrument: string
  role: MemberRole
  joinYear: number
  phone: string
  active: number
  notes: string
}

/**
 * Baca satu baris CSV anggota.
 *
 * Berkas lama tidak punya kolom Panggilan. Kalau judulnya tidak menyebut
 * kolom itu, urutan lamanya tetap dipakai — impor tidak boleh menggeser
 * section menjadi panggilan.
 */
export function bacaBarisCsvAnggota(
  sel: string[],
  judul: string[] | null,
  sections: { id: string; label: string }[],
): BarisCsvAnggota | null {
  const indeks = (nama: string, cadangan: number) => {
    if (!judul) return cadangan
    const i = judul.findIndex((h) => norm(h) === norm(nama))
    return i >= 0 ? i : -1
  }
  const adaPanggilan = !!judul && judul.some((h) => norm(h) === 'panggilan')
  const ambil = (nama: string, lama: number) => {
    const i = adaPanggilan || judul ? indeks(nama, lama) : lama
    if (i < 0) return ''
    return sel[i] ?? ''
  }
  const name = (adaPanggilan || judul ? ambil('Nama', 1) : sel[1] ?? '').trim()
  if (!name) return null
  const sectionMentah = adaPanggilan || judul ? ambil('Section', 2) : (sel[2] ?? '')
  const sec = sections.find(
    (s) => norm(s.label) === norm(sectionMentah) || norm(s.id) === norm(sectionMentah),
  )
  const peranMentah = adaPanggilan || judul ? ambil('Peran', 4) : (sel[4] ?? '')
  const role = PERAN_DARI_TEKS[norm(peranMentah)] ?? 'member'
  const status = adaPanggilan || judul ? ambil('Status', 7) : (sel[7] ?? '')
  const tahun = Number(adaPanggilan || judul ? ambil('Tahun Masuk', 5) : sel[5])
  const panggilan = adaPanggilan ? ambil('Panggilan', -1).trim() : ''
  return {
    code: (adaPanggilan || judul ? ambil('Kode', 0) : (sel[0] ?? '')).trim(),
    name,
    panggilan: panggilan || undefined,
    section: sec?.id ?? 'other',
    instrument: adaPanggilan || judul ? ambil('Instrumen', 3) : (sel[3] ?? ''),
    role,
    joinYear: Number.isFinite(tahun) && tahun > 0 ? tahun : new Date().getFullYear(),
    phone: adaPanggilan || judul ? ambil('No. HP', 6) : (sel[6] ?? ''),
    active: norm(status) === 'nonaktif' ? 0 : 1,
    notes: adaPanggilan || judul ? ambil('Catatan', 8) : (sel[8] ?? ''),
  }
}
