/**
 * v2.10.1 — Sesi ganda: dua sesi latihan di tanggal yang sama (mis. 17.30
 * dibuat tangan dan 18.00 dari jadwal berulang). Absensi bisa terpecah ke
 * keduanya dan program menautkan yang salah. Modul murni ini menemukan
 * pasangan itu dan menyusun penggabungannya; diuji `qa/gabung-sesi-logika.mjs`.
 *
 * Penggabungan tidak membuang informasi tanpa sepengetahuan pelatih:
 * - catatan absensi sesi yang dihapus pindah ke sesi yang dipertahankan;
 * - bila anak tercatat di keduanya, yang lebih kuat menang (hadir > izin/sakit
 *   > alpa) dan jumlah bentrokannya dilaporkan;
 * - isian sesi yang kosong di sesi utama diambil dari kembarannya (rencana,
 *   checklist, tautan rundown, isian Form);
 * - tautan program, manifes lomba, penilaian, dan musim TC dialihkan.
 */
import type { AttendanceRecord, AttendanceStatus, MusimTc, ProgramLatihan, Session } from '../db/types'

/** Jenis sesi yang dianggap sesi latihan untuk deteksi ganda. */
const JENIS_LATIHAN = new Set<string>(['latihan', 'section', 'gabungan'])

export interface KelompokGanda {
  tanggal: string
  /** Urut: usulan utama dulu. */
  sesi: Session[]
  /** Jumlah catatan absensi per sesi. */
  absensi: Record<string, number>
}

const menit = (j: string) => {
  const [h, m] = (j || '0:0').split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

/** Dua sesi bertumpang tindih waktunya (atau salah satunya tanpa jam selesai). */
export function bertumpuk(a: Pick<Session, 'startTime' | 'endTime'>, b: Pick<Session, 'startTime' | 'endTime'>): boolean {
  const a0 = menit(a.startTime)
  const b0 = menit(b.startTime)
  const a1 = a.endTime ? menit(a.endTime) : a0 + 120
  const b1 = b.endTime ? menit(b.endTime) : b0 + 120
  return a0 < b1 && b0 < a1
}

/**
 * Usulan sesi yang dipertahankan: absensi terbanyak → milik program →
 * sudah berjalan/berencana → bukan bagian seri (dibuat sengaja) → paling awal.
 */
export function urutUsulan(sesi: Session[], absensi: Record<string, number>, milikProgram: ReadonlySet<string> = new Set()): Session[] {
  const skor = (s: Session) => [
    absensi[s.id] ?? 0,
    milikProgram.has(s.id) ? 1 : 0,
    (s.realisasiLatihan?.length ?? 0) > 0 || s.mulaiNyata ? 1 : 0,
    (s.rencanaLatihan?.length ?? 0) > 0 ? 1 : 0,
  ]
  return [...sesi].sort((a, b) => {
    const x = skor(a)
    const y = skor(b)
    for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return y[i] - x[i]
    return `${a.startTime}`.localeCompare(`${b.startTime}`) || a.id.localeCompare(b.id)
  })
}

/** Cari tanggal yang punya ≥2 sesi latihan sejenis yang bertumpuk. */
export function cariSesiGanda(
  semua: Session[],
  catatan: Pick<AttendanceRecord, 'sessionId'>[],
  milikProgram: ReadonlySet<string> = new Set(),
): KelompokGanda[] {
  const jumlah: Record<string, number> = {}
  for (const r of catatan) jumlah[r.sessionId] = (jumlah[r.sessionId] ?? 0) + 1
  // Kelompok per tanggal + jenis. Sectional berbeda seksi boleh bersamaan,
  // jadi sesi jenis `section` hanya dianggap ganda bila judulnya sama.
  const perTanggal = new Map<string, Session[]>()
  for (const s of semua) {
    if (!JENIS_LATIHAN.has(s.type)) continue
    const k = `${s.date}|${s.type}${s.type === 'section' ? `|${s.title.trim().toLowerCase()}` : ''}`
    const d = perTanggal.get(k) ?? []
    d.push(s)
    perTanggal.set(k, d)
  }
  const hasil: KelompokGanda[] = []
  for (const [kunci, daftar] of perTanggal) {
    const tanggal = kunci.slice(0, kunci.indexOf('|'))
    if (daftar.length < 2) continue
    // Kelompok = sesi yang bertumpuk dengan setidaknya satu sesi lain.
    const ikut = daftar.filter((s) => daftar.some((t) => t.id !== s.id && bertumpuk(s, t)))
    if (ikut.length < 2) continue
    const absensi: Record<string, number> = {}
    for (const s of ikut) absensi[s.id] = jumlah[s.id] ?? 0
    hasil.push({ tanggal, sesi: urutUsulan(ikut, absensi, milikProgram), absensi })
  }
  return hasil.sort((a, b) => a.tanggal.localeCompare(b.tanggal) || a.sesi[0].startTime.localeCompare(b.sesi[0].startTime))
}

const KEKUATAN: Record<AttendanceStatus, number> = { hadir: 3, sakit: 2, izin: 2, alpha: 1 }

export interface RencanaGabung {
  utama: Session
  /** Sesi yang dihapus sesudah digabung. */
  hapus: string[]
  /** Catatan absensi yang ditulis (dipindah atau diperbarui). */
  tulis: AttendanceRecord[]
  /** Id catatan absensi yang dibuang (kalah bentrok atau sudah dipindah ke catatan utama). */
  buang: string[]
  dipindah: number
  /** Anak tercatat di dua sesi; yang lebih kuat dipakai. */
  bentrok: number
}

/** Kunci yang tidak pernah diambil dari kembaran. */
const KUNCI_TETAP = new Set(['id', 'date', 'startTime', 'endTime', 'title', 'type', 'seriId', 'createdAt'])
const KUNCI_PACU = new Set(['realisasiLatihan', 'rencanaAwal', 'jejakPacu'])

const kosong = (v: unknown) =>
  v == null || v === '' || (Array.isArray(v) && v.length === 0) || (typeof v === 'object' && !Array.isArray(v) && Object.keys(v as object).length === 0)

/** Susun penggabungan `ganda` ke `utama`. Murni — tidak menulis apa pun. */
export function rencanaGabung(utama: Session, ganda: Session[], catatan: AttendanceRecord[]): RencanaGabung {
  const idGanda = new Set(ganda.map((s) => s.id).filter((id) => id !== utama.id))
  const milikUtama = new Map(catatan.filter((r) => r.sessionId === utama.id).map((r) => [r.memberId, r]))
  const tulis = new Map<string, AttendanceRecord>()
  const buang: string[] = []
  let dipindah = 0
  let bentrok = 0
  // Catatan kembaran, urut supaya hasil tidak bergantung pada urutan masukan.
  const pindahan = catatan
    .filter((r) => idGanda.has(r.sessionId))
    .sort((a, b) => KEKUATAN[b.status] - KEKUATAN[a.status] || a.id.localeCompare(b.id))
  for (const r of pindahan) {
    const ada = tulis.get(r.memberId) ?? milikUtama.get(r.memberId)
    if (!ada) {
      tulis.set(r.memberId, { ...r, sessionId: utama.id })
      dipindah++
      continue
    }
    bentrok++
    if (KEKUATAN[r.status] > KEKUATAN[ada.status]) {
      // Data kembaran lebih kuat: pakai isinya, pertahankan id catatan utama.
      tulis.set(r.memberId, { ...r, id: ada.id, sessionId: utama.id })
      if (ada.id !== r.id) buang.push(r.id)
    } else {
      buang.push(r.id)
    }
  }
  // Isian sesi yang kosong diambil dari kembaran (urutan masukan = prioritas).
  const hasil: Session = { ...utama }
  const rec = hasil as unknown as Record<string, unknown>
  // Catatan Pacu hanya bermakna bersama rencana pasangannya (id blok sama):
  // ikut sesi yang menyumbang rencanaLatihan, tidak dicampur dari kembaran lain.
  const sumberRencana = kosong(utama.rencanaLatihan)
    ? ganda.find((g) => idGanda.has(g.id) && !kosong(g.rencanaLatihan))
    : undefined
  for (const g of ganda) {
    if (!idGanda.has(g.id)) continue
    for (const [k, v] of Object.entries(g)) {
      if (KUNCI_TETAP.has(k) || kosong(v)) continue
      if (KUNCI_PACU.has(k)) {
        if (g === sumberRencana) rec[k] = v
        continue
      }
      if (k === 'formPresensi') {
        const gabung: Record<string, number> = { ...(hasil.formPresensi ?? {}) }
        for (const [m, t] of Object.entries(v as Record<string, number>)) gabung[m] = Math.min(gabung[m] ?? Infinity, t)
        hasil.formPresensi = gabung
        continue
      }
      if (k === 'formKeterangan') {
        // v2.13 — keterangan Form per anak: yang sudah ada di sesi utama menang.
        hasil.formKeterangan = { ...(v as NonNullable<Session['formKeterangan']>), ...(hasil.formKeterangan ?? {}) }
        continue
      }
      if (k === 'checklist') {
        const ada = new Set((hasil.checklist ?? []).map((c) => c.text.trim().toLowerCase()))
        const tambah = (v as Session['checklist']).filter((c) => !ada.has(c.text.trim().toLowerCase()))
        if (tambah.length) hasil.checklist = [...(hasil.checklist ?? []), ...tambah]
        continue
      }
      if (k === 'notes' && hasil.notes && hasil.notes.trim() !== String(v).trim()) {
        hasil.notes = `${hasil.notes.trim()}\n${String(v).trim()}`
        continue
      }
      if (kosong(rec[k])) rec[k] = v
    }
  }
  return { utama: hasil, hapus: [...idGanda], tulis: [...tulis.values()], buang, dipindah, bentrok }
}

/** Alihkan id sesi di program latihan (sesiIds & wajibIds), tanpa duplikat. */
export function alihkanIdProgram(daftar: ProgramLatihan[], dari: ReadonlySet<string>, ke: string): { daftar: ProgramLatihan[]; berubah: boolean } {
  let berubah = false
  const ganti = (ids: string[]) => {
    if (!ids.some((x) => dari.has(x))) return ids
    berubah = true
    const out: string[] = []
    for (const x of ids) {
      const y = dari.has(x) ? ke : x
      if (!out.includes(y)) out.push(y)
    }
    return out
  }
  const hasil = daftar.map((p) => {
    const sesiIds = ganti(p.sesiIds)
    const wajibIds = ganti(p.wajibIds)
    return sesiIds === p.sesiIds && wajibIds === p.wajibIds ? p : { ...p, sesiIds, wajibIds }
  })
  return { daftar: hasil, berubah }
}

/** Alihkan `sessionId` musim TC. */
export function alihkanIdMusim(daftar: MusimTc[], dari: ReadonlySet<string>, ke: string): { daftar: MusimTc[]; berubah: boolean } {
  let berubah = false
  const hasil = daftar.map((m) => {
    if (!m.sessionId || !dari.has(m.sessionId)) return m
    berubah = true
    return { ...m, sessionId: ke }
  })
  return { daftar: hasil, berubah }
}
