/**
 * v2.8 — Impor CSV jawaban Google Form ke Absensi. Murni (tanpa Dexie/React),
 * diuji `qa/kehadiran-rasio-logika.mjs`.
 *
 * Tiga jenis Form, satu alur (baca CSV → tebak kolom → cocokkan nama →
 * tentukan sesi → rencana → terapkan):
 *
 * - **presensi** — Form yang dibuka ±24 jam sebelum latihan. Cap waktu isian
 *   disimpan di `Session.formPresensi`, **bukan** sebagai catatan hadir:
 *   mengisi Form belum berarti datang.
 * - **izin** — Form izin/sakit. Membuat/memperbarui catatan izin/sakit dengan
 *   jam lapor = cap waktu Form, kategori ditebak dari jawaban, dan tautan
 *   bukti (kolom unggah berkas).
 * - **datang** — rekap absen fisik admin (nama + jam datang [+ alasan telat]).
 *
 * Tidak ada yang ditulis tanpa pratinjau; baris yang bentrok (mis. Form izin
 * dari anak yang tercatat hadir) dilewati dan dilaporkan.
 */
import type { AttendanceRecord, AttendanceStatus, KategoriIzin, Member, Session } from '../db/types'
import { kemiripanNama, norm } from './namaAnggota'
import { tebakPemisahCsv } from './rosterAnggota'

export type JenisFormImpor = 'presensi' | 'izin' | 'datang'
export type KolomGForm = 'waktu' | 'nama' | 'tanggal' | 'jam' | 'alasan' | 'kategori' | 'bukti'
/** Indeks kolom CSV per peran; `-1` = tidak ada. */
export type PetaKolomGForm = Record<KolomGForm, number>
export type UrutanTanggal = 'dmy' | 'mdy'

/* ---------------------------------- CSV ---------------------------------- */

/**
 * Pembaca CSV utuh (bukan per baris): sel berkutip boleh memuat baris baru —
 * jawaban paragraf Google Form sering begitu. Pemisah ditebak dari judul.
 */
export function bacaCsvForm(teks: string): string[][] {
  const bersih = teks.replace(/^\uFEFF/, '')
  const judul = bersih.split(/\r?\n/, 1)[0] ?? ''
  const pemisah = tebakPemisahCsv(judul) ?? ','
  const baris: string[][] = []
  let sel = ''
  let kini: string[] = []
  let kutip = false
  for (let i = 0; i < bersih.length; i++) {
    const ch = bersih[i]
    if (kutip) {
      if (ch === '"') {
        if (bersih[i + 1] === '"') {
          sel += '"'
          i++
        } else kutip = false
      } else sel += ch
    } else if (ch === '"') kutip = true
    else if (ch === pemisah) {
      kini.push(sel.trim())
      sel = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && bersih[i + 1] === '\n') i++
      kini.push(sel.trim())
      if (kini.some((x) => x !== '')) baris.push(kini)
      kini = []
      sel = ''
    } else sel += ch
  }
  kini.push(sel.trim())
  if (kini.some((x) => x !== '')) baris.push(kini)
  return baris
}

/* ------------------------------ tebak kolom ------------------------------ */

const POLA_KOLOM: [KolomGForm, RegExp][] = [
  ['waktu', /^(timestamp|cap waktu|stempel waktu|waktu (isian|pengisian|kirim)|submitted)/],
  ['bukti', /(bukti|lampiran|unggah|upload|foto|surat|dokumen)/],
  ['kategori', /(kategori|jenis (izin|alasan)|tipe izin)/],
  ['jam', /(jam (datang|hadir|tiba|masuk)|waktu (datang|tiba|hadir)|^jam$|^datang$)/],
  ['tanggal', /(tanggal|tgl|hari latihan|sesi|latihan tanggal)/],
  ['alasan', /(alasan|keterangan|ket\b|catatan|kepentingan|izin karena)/],
  ['nama', /(nama)/],
]

/** Tebak peran tiap kolom dari judul. Kolom pertama yang cocok menang. */
export function tebakKolomGForm(judul: string[]): PetaKolomGForm {
  const peta: PetaKolomGForm = { waktu: -1, nama: -1, tanggal: -1, jam: -1, alasan: -1, kategori: -1, bukti: -1 }
  const dipakai = new Set<number>()
  for (const [peran, pola] of POLA_KOLOM) {
    for (let i = 0; i < judul.length; i++) {
      if (dipakai.has(i)) continue
      const j = norm(judul[i])
      if (!j) continue
      // "Nama panggilan" kalah dari "Nama lengkap" bila keduanya ada.
      if (peran === 'nama' && /panggil/.test(j) && judul.some((x, k) => k !== i && /nama/.test(norm(x)) && !/panggil/.test(norm(x)))) continue
      if (pola.test(j)) {
        peta[peran] = i
        dipakai.add(i)
        break
      }
    }
  }
  return peta
}

/* ------------------------------ tanggal & jam ------------------------------ */

const BULAN: Record<string, number> = {
  jan: 1, januari: 1, january: 1,
  feb: 2, februari: 2, february: 2, peb: 2,
  mar: 3, maret: 3, march: 3,
  apr: 4, april: 4,
  mei: 5, may: 5,
  jun: 6, juni: 6, june: 6,
  jul: 7, juli: 7, july: 7,
  agu: 8, agt: 8, agustus: 8, aug: 8, august: 8,
  sep: 9, sept: 9, september: 9,
  okt: 10, oktober: 10, oct: 10, october: 10,
  nov: 11, nopember: 11, november: 11,
  des: 12, desember: 12, dec: 12, december: 12,
}

const iso = (y: number, m: number, d: number) =>
  `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`

function tanggalSah(y: number, m: number, d: number): string | null {
  if (y < 100) y += 2000
  if (m < 1 || m > 12 || d < 1 || d > 31) return null
  const t = new Date(y, m - 1, d)
  return t.getMonth() === m - 1 ? iso(y, m, d) : null
}

/**
 * Tebak urutan tanggal numerik dari contoh nilai: ada bagian pertama > 12 →
 * d/m/y; ada bagian kedua > 12 → m/d/y; selain itu d/m/y (Google Form
 * berbahasa Indonesia).
 */
export function tebakUrutanTanggal(contoh: string[]): UrutanTanggal {
  for (const v of contoh) {
    const m = v.trim().match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
    if (!m) continue
    if (Number(m[1]) > 12) return 'dmy'
    if (Number(m[2]) > 12) return 'mdy'
  }
  return 'dmy'
}

/** Bagian tanggal → ISO. Menerima 12/11/2026, 2026-11-12, "Kamis, 12 November 2026", "12 Nov". */
export function bacaTanggalForm(teks: string, urutan: UrutanTanggal = 'dmy', tahunCadangan?: number): string | null {
  const t = teks.trim()
  if (!t) return null
  let m = t.match(/(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) return tanggalSah(Number(m[1]), Number(m[2]), Number(m[3]))
  m = t.match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/)
  if (m) {
    const a = Number(m[1])
    const b = Number(m[2])
    return urutan === 'mdy' ? tanggalSah(Number(m[3]), a, b) : tanggalSah(Number(m[3]), b, a)
  }
  m = norm(t).match(/(\d{1,2}) ([a-z]+)(?: (\d{2,4}))?/)
  if (m && BULAN[m[2]]) {
    const y = m[3] ? Number(m[3]) : tahunCadangan
    return y ? tanggalSah(y, BULAN[m[2]], Number(m[1])) : null
  }
  return null
}

/** Jam → menit sejak tengah malam. "18.45", "18:45:10", "6:45 PM", "18". */
export function bacaJamForm(teks: string): number | null {
  const t = teks.trim().toLowerCase()
  const m = t.match(/(\d{1,2})(?:[:.](\d{2}))?(?:[:.](\d{2}))?\s*(am|pm)?/)
  if (!m) return null
  let h = Number(m[1])
  const mm = Number(m[2] ?? 0)
  if (m[4] === 'pm' && h < 12) h += 12
  if (m[4] === 'am' && h === 12) h = 0
  if (h > 23 || mm > 59) return null
  return h * 60 + mm
}

/** Cap waktu Google Form → epoch ms waktu setempat. */
export function bacaCapWaktu(teks: string, urutan: UrutanTanggal = 'dmy'): number | null {
  const tgl = bacaTanggalForm(teks, urutan)
  if (!tgl) return null
  // Buang bagian tanggal supaya angka tanggal tidak terbaca sebagai jam.
  const sisa = teks.replace(/\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/, ' ')
  const jam = /\d/.test(sisa) ? bacaJamForm(sisa) : 0
  const [y, mo, d] = tgl.split('-').map(Number)
  return new Date(y, mo - 1, d, 0, jam ?? 0).getTime()
}

/* ------------------------------ kategori izin ------------------------------ */

/** Kata kunci per kategori bawaan — kategori tambahan pelatih dicocokkan lewat namanya. */
const KATA_KATEGORI: Record<string, RegExp> = {
  sakit: /(sakit|dokter|demam|opname|rawat inap|klinik|rumah sakit|\brs\b)/,
  ortu: /(orang ?tua|ortu|ayah|ibu|bapak|mama|papa|om|tante|kakek|nenek|keluarga datang|dikunjungi)/,
  kuliah: /(praktikum|asistensi|asisten|responsi|kuliah|kelas pengganti|ujian|kuis|quiz)/,
  agama: /(ibadah|gereja|misa|keagamaan|retret|retreat|pengajian|sembahyang|pura|vihara|jumatan|doa)/,
  duka: /(duka|meninggal|wafat|melayat|layat|pemakaman)/,
  lomba: /(lomba|pomda|porda|kejuaraan|pertandingan|olimpiade|mewakili)/,
  organisasi: /(bem|hima|ukm|organisasi|kepanitiaan|panitia|event)/,
}

/**
 * Tebak kategori dari jawaban. Nama kategori yang persis/terkandung menang;
 * lalu kata kunci. `lain` = ada jawaban tapi tidak cocok; `undefined` = kosong.
 * "Rapat" organisasi bukan izin — sengaja jatuh ke `lain`.
 */
export function tebakKategoriIzin(teks: string, daftar: readonly KategoriIzin[]): string | undefined {
  const t = norm(teks)
  if (!t) return undefined
  for (const k of daftar) {
    const n = norm(k.nama)
    if (n && (t === n || t.startsWith(n) || (n.length >= 6 && t.includes(n)))) return k.id
  }
  if (/\brapat\b/.test(t) && !KATA_KATEGORI.sakit.test(t)) return 'lain'
  for (const k of daftar) {
    const pola = KATA_KATEGORI[k.id]
    if (pola?.test(t)) return k.id
  }
  return 'lain'
}

/* ------------------------------ cocok nama ------------------------------ */

export interface CocokNamaForm {
  memberId: string | null
  skor: number
  /** Kandidat terbaik (urut skor), untuk pilihan manual. */
  kandidat: { memberId: string; skor: number }[]
}

export const AMBANG_COCOK_FORM = 0.85

/** Cocokkan nama isian Form dengan anggota (nama lengkap, panggilan, atau kode). */
export function cocokkanNamaForm(teks: string, anggota: Pick<Member, 'id' | 'name' | 'panggilan' | 'code'>[]): CocokNamaForm {
  const t = teks.trim()
  if (!t) return { memberId: null, skor: 0, kandidat: [] }
  const kode = norm(t)
  const skor = anggota
    .map((m) => ({
      memberId: m.id,
      skor: norm(m.code) && norm(m.code) === kode ? 1 : Math.max(kemiripanNama(t, m.name), kemiripanNama(t, m.panggilan)),
    }))
    .filter((x) => x.skor > 0.5)
    .sort((a, b) => b.skor - a.skor)
  const [a, b] = skor
  const yakin = !!a && a.skor >= AMBANG_COCOK_FORM && (!b || b.skor < a.skor)
  return { memberId: yakin ? a.memberId : null, skor: a?.skor ?? 0, kandidat: skor.slice(0, 5) }
}

/* ------------------------------ sesi ------------------------------ */

const JAM_MS = 3_600_000
const msSesi = (s: Pick<Session, 'date'>, jam: string) => {
  const [y, m, d] = s.date.split('-').map(Number)
  const [hh, mm] = (jam || '00:00').split(':').map(Number)
  return new Date(y, m - 1, d, hh || 0, mm || 0).getTime()
}

/**
 * Sesi untuk satu isian. Kolom tanggal menang. Tanpa tanggal: sesi pertama
 * yang belum selesai pada cap waktu isian, paling jauh 48 jam (presensi) /
 * 7 hari (izin) ke depan. Absen fisik tanpa tanggal memakai hari cap waktu.
 */
export function sesiUntukIsian(
  jenis: JenisFormImpor,
  capWaktu: number | null,
  tanggal: string | null,
  sesi: Session[],
): Session | null {
  const urut = [...sesi].sort((a, b) => `${a.date} ${a.startTime}`.localeCompare(`${b.date} ${b.startTime}`))
  if (tanggal) return urut.find((s) => s.date === tanggal) ?? null
  if (capWaktu == null) return null
  if (jenis === 'datang') {
    const d = new Date(capWaktu)
    const hari = iso(d.getFullYear(), d.getMonth() + 1, d.getDate())
    return urut.find((s) => s.date === hari) ?? null
  }
  const jangkau = (jenis === 'presensi' ? 48 : 24 * 7) * JAM_MS
  return (
    urut.find((s) => {
      const mulai = msSesi(s, s.startTime)
      const selesai = s.endTime ? msSesi(s, s.endTime) : mulai + 2 * JAM_MS
      return selesai >= capWaktu && mulai - capWaktu <= jangkau
    }) ?? null
  )
}

/* ------------------------------ rencana ------------------------------ */

export type AksiImpor = 'tambah' | 'perbarui' | 'sama' | 'bentrok' | 'ganda' | 'lewati'

export interface BarisRencanaForm {
  /** Nomor baris data (1 = baris pertama sesudah judul). */
  no: number
  nama: string
  cocok: CocokNamaForm
  memberId: string | null
  sesiId: string | null
  capWaktu: number | null
  /** Menit sejak tengah malam (jenis `datang`). */
  jamDatang: number | null
  kategori?: string
  alasan: string
  bukti: string
  aksi: AksiImpor
  pesan: string
}

export interface OpsiRencanaForm {
  jenis: JenisFormImpor
  baris: string[][]
  peta: PetaKolomGForm
  urutan: UrutanTanggal
  anggota: Member[]
  sesi: Session[]
  catatan: AttendanceRecord[]
  kategori: readonly KategoriIzin[]
  /** Paksa semua isian ke satu sesi (kosong = otomatis). */
  sesiTetap?: string
  /** Pilihan manual anggota per nomor baris (menimpa pencocokan otomatis). */
  pilihan?: Record<number, string | null>
}

const sel = (b: string[], i: number) => (i >= 0 ? (b[i] ?? '').trim() : '')

/** Susun rencana impor (tanpa menulis apa pun). `baris` sudah tanpa judul. */
export function rencanakanImporForm(o: OpsiRencanaForm): BarisRencanaForm[] {
  const peta = new Map(o.catatan.map((r) => [`${r.sessionId}|${r.memberId}`, r]))
  const perSesi = new Map(o.sesi.map((s) => [s.id, s]))
  const terlihat = new Set<string>()
  const hasil: BarisRencanaForm[] = []
  o.baris.forEach((b, i) => {
    const no = i + 1
    const nama = sel(b, o.peta.nama)
    const capWaktu = o.peta.waktu >= 0 ? bacaCapWaktu(sel(b, o.peta.waktu), o.urutan) : null
    const tahun = capWaktu != null ? new Date(capWaktu).getFullYear() : undefined
    const tanggal = o.peta.tanggal >= 0 ? bacaTanggalForm(sel(b, o.peta.tanggal), o.urutan, tahun) : null
    const alasan = sel(b, o.peta.alasan)
    const bukti = sel(b, o.peta.bukti)
    const jamDatang = o.peta.jam >= 0 ? bacaJamForm(sel(b, o.peta.jam)) : null
    const teksKategori = sel(b, o.peta.kategori) || alasan
    const kategori = o.jenis === 'izin' ? tebakKategoriIzin(teksKategori, o.kategori) : undefined
    const cocok = cocokkanNamaForm(nama, o.anggota)
    const memberId = o.pilihan && no in o.pilihan ? o.pilihan[no] : cocok.memberId
    const sesi = o.sesiTetap ? (perSesi.get(o.sesiTetap) ?? null) : sesiUntukIsian(o.jenis, capWaktu, tanggal, o.sesi)
    const dasar = { no, nama, cocok, memberId, sesiId: sesi?.id ?? null, capWaktu, jamDatang, kategori, alasan, bukti }
    const keluar = (aksi: AksiImpor, pesan: string) => hasil.push({ ...dasar, aksi, pesan })
    if (!nama) return keluar('lewati', 'Nama kosong')
    if (!memberId) return keluar('lewati', cocok.kandidat.length ? 'Nama tidak pasti — pilih anggotanya' : 'Nama tidak dikenal')
    if (!sesi) return keluar('lewati', o.jenis === 'izin' ? 'Sesi tidak ditemukan — pakai kolom tanggal atau pilih sesi' : 'Tidak ada sesi yang cocok dengan cap waktunya')
    if ((o.jenis === 'presensi' || o.jenis === 'izin') && capWaktu == null) return keluar('lewati', 'Cap waktu tidak terbaca')
    const kunci = `${sesi.id}|${memberId}`
    if (terlihat.has(kunci)) return keluar('ganda', 'Isian ganda — hanya isian pertama yang dipakai')
    terlihat.add(kunci)
    const ada = peta.get(kunci)
    if (o.jenis === 'presensi') {
      const lama = sesi.formPresensi?.[memberId]
      if (lama != null && lama <= capWaktu!) return keluar('sama', 'Sudah tercatat')
      return keluar(lama != null ? 'perbarui' : 'tambah', ada ? `Catatan absen: ${ada.status}` : 'Belum ada catatan absen fisik')
    }
    if (o.jenis === 'izin') {
      if (ada?.status === 'hadir') return keluar('bentrok', 'Tercatat hadir di sesi ini — dilewati')
      const status: AttendanceStatus = kategori === 'sakit' ? 'sakit' : 'izin'
      if (!ada) return keluar('tambah', `${status === 'sakit' ? 'Sakit' : 'Izin'} baru`)
      if (ada.status === 'alpha') return keluar('perbarui', `Tanpa keterangan → ${status}`)
      const beda =
        (ada.dilaporAt == null || capWaktu! < ada.dilaporAt) || (!ada.kategoriIzin && !!kategori) || (!ada.bukti && !!bukti) || (!ada.note && !!alasan)
      return keluar(beda ? 'perbarui' : 'sama', beda ? 'Lengkapi jam lapor/kategori/bukti' : 'Sudah tercatat')
    }
    // datang
    if (ada && (ada.status === 'izin' || ada.status === 'sakit')) return keluar('bentrok', `Tercatat ${ada.status} — dilewati`)
    const datangAt = jamDatang != null ? msSesi(sesi, `${Math.floor(jamDatang / 60)}:${jamDatang % 60}`) : undefined
    if (!ada) return keluar('tambah', 'Hadir baru')
    if (ada.status === 'alpha') return keluar('perbarui', 'Tanpa keterangan → hadir')
    const beda = (datangAt != null && ada.datangAt !== datangAt) || (!!alasan && ada.alasanTelat !== alasan) || (!!bukti && ada.bukti !== bukti)
    return keluar(beda ? 'perbarui' : 'sama', beda ? 'Perbarui jam datang/alasan' : 'Sudah tercatat')
  })
  return hasil
}

export interface HasilTerapForm {
  catatan: AttendanceRecord[]
  /** sessionId → formPresensi baru (utuh). */
  form: Record<string, Record<string, number>>
  jumlah: number
}

/** Ubah rencana menjadi tulisan (catatan absensi & isian Form sesi). Murni. */
export function terapkanImporForm(
  jenis: JenisFormImpor,
  rencana: BarisRencanaForm[],
  catatan: AttendanceRecord[],
  sesi: Session[],
  buatId: () => string,
): HasilTerapForm {
  const peta = new Map(catatan.map((r) => [`${r.sessionId}|${r.memberId}`, r]))
  const perSesi = new Map(sesi.map((s) => [s.id, s]))
  const keluar: AttendanceRecord[] = []
  const form: Record<string, Record<string, number>> = {}
  let jumlah = 0
  for (const b of rencana) {
    if ((b.aksi !== 'tambah' && b.aksi !== 'perbarui') || !b.memberId || !b.sesiId) continue
    const s = perSesi.get(b.sesiId)
    if (!s) continue
    jumlah++
    if (jenis === 'presensi') {
      const f = (form[s.id] ??= { ...(s.formPresensi ?? {}) })
      f[b.memberId] = Math.min(f[b.memberId] ?? Infinity, b.capWaktu!)
      continue
    }
    const ada = peta.get(`${s.id}|${b.memberId}`)
    if (jenis === 'izin') {
      const status: AttendanceStatus = b.kategori === 'sakit' ? 'sakit' : 'izin'
      const izinLama = ada && (ada.status === 'izin' || ada.status === 'sakit')
      const r: AttendanceRecord = {
        ...(ada ?? { id: buatId(), sessionId: s.id, memberId: b.memberId }),
        status: izinLama ? ada!.status : status,
        dilaporAt: izinLama && ada!.dilaporAt != null ? Math.min(ada!.dilaporAt, b.capWaktu!) : b.capWaktu!,
      }
      if (b.kategori && !r.kategoriIzin) r.kategoriIzin = b.kategori
      if (b.bukti && !r.bukti) r.bukti = b.bukti
      if (b.alasan && !r.note) r.note = b.alasan
      delete r.datangAt
      delete r.alasanTelat
      keluar.push(r)
      continue
    }
    const r: AttendanceRecord = {
      ...(ada ?? { id: buatId(), sessionId: s.id, memberId: b.memberId }),
      status: 'hadir',
    }
    if (b.jamDatang != null) r.datangAt = msSesi(s, `${Math.floor(b.jamDatang / 60)}:${b.jamDatang % 60}`)
    if (b.alasan) r.alasanTelat = b.alasan
    if (b.bukti) r.bukti = b.bukti
    delete r.dilaporAt
    delete r.kategoriIzin
    keluar.push(r)
  }
  return { catatan: keluar, form, jumlah }
}

/** Ringkasan jumlah per aksi. */
export function ringkasRencanaForm(r: BarisRencanaForm[]): Record<AksiImpor, number> {
  const out: Record<AksiImpor, number> = { tambah: 0, perbarui: 0, sama: 0, bentrok: 0, ganda: 0, lewati: 0 }
  for (const b of r) out[b.aksi]++
  return out
}
