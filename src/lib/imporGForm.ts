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
import type { AttendanceRecord, AttendanceStatus, KategoriIzin, KeteranganForm, Member, Session } from '../db/types'
import { kemiripanNama, norm } from './namaAnggota'
import { tebakPemisahCsv } from './rosterAnggota'
import { lengkapiDariForm } from './keteranganForm'

export { lengkapiDariForm }

export type JenisFormImpor = 'presensi' | 'izin' | 'datang'
export type KolomGForm = 'waktu' | 'nama' | 'tanggal' | 'jam' | 'pulang' | 'status' | 'alasan' | 'kategori' | 'bukti'
/**
 * Indeks kolom CSV per peran; `-1` = tidak ada. `alasanLain` (v2.13) — kolom
 * alasan tambahan pada Form lama yang memecah alasan per keadaan ("Alasan
 * datang terlambat", "Alasan tidak hadir", …); isinya digabung ke alasan.
 */
export type PetaKolomGForm = Record<KolomGForm, number> & { alasanLain?: number[] }
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

/**
 * Pola judul kolom per peran, dicoba berurutan. Diekspor supaya diuji dan
 * dipakai ulang (v2.10.1). "Jam pulang" dicoba sebelum "jam datang", dan
 * "Status" sebelum "keterangan" — Form izin/presensi MBA memakai keduanya.
 */
export const POLA_KOLOM: [KolomGForm, RegExp][] = [
  ['waktu', /^(timestamp|cap waktu|stempel waktu|waktu (isian|pengisian|kirim)|submitted)/],
  ['pulang', /(jam (pulang|keluar|selesai)|waktu pulang|pulang (jam|pukul)|^pulang$)/],
  ['status', /^(status( kehadiran)?|kehadiran|hadir atau tidak|keterangan (hadir|kehadiran))$/],
  ['bukti', /(bukti|lampiran|unggah|upload|foto|surat|dokumen)/],
  ['kategori', /(kategori|jenis (izin|alasan)|tipe izin)/],
  ['jam', /(jam (datang|hadir|tiba|masuk)|waktu (datang|tiba|hadir)|^jam$|^datang$)/],
  ['tanggal', /(tanggal|tgl|hari latihan|sesi|latihan tanggal)/],
  ['alasan', /(alasan|keterangan|ket\b|catatan|kepentingan|izin karena)/],
  ['nama', /(nama)/],
]

/** Tebak peran tiap kolom dari judul. Kolom pertama yang cocok menang. */
export function tebakKolomGForm(judul: string[]): PetaKolomGForm {
  const peta: PetaKolomGForm = { waktu: -1, nama: -1, tanggal: -1, jam: -1, pulang: -1, status: -1, alasan: -1, kategori: -1, bukti: -1 }
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
  const lain = judul.flatMap((x, i) => (!dipakai.has(i) && /\balasan\b/.test(norm(x)) ? [i] : []))
  if (lain.length) peta.alasanLain = lain
  return peta
}

/**
 * Jawaban pengisi kolom yang sebenarnya kosong ("-", "Tdk ada", "Hadir"…).
 * v2.15: juga "tepat waktu", "belum tau", "tidak", "sampai selesai" — Form
 * P4 memuat isian seperti itu di kolom Pulang duluan dari anak yang hadir penuh.
 */
const ISIAN_KOSONG =
  /^(|tdk ada|tidak ada|gak ada|ga ada|nggak ada|nihil|none|kosong|on time|ontime|tepat waktu|hadir|hadir tepat waktu|tidak bisa hadir|tidak|tdk|gak|nggak|no|belum tau|belum tahu|blm tau|tidak tau|tidak tahu|tidak pulang( duluan| awal| lebih awal)?|sampai selesai|ikut sampai selesai|full)$/

/** v2.15 — sel berisi jawaban sungguhan (bukan isian pengisi seperti "-" atau "tidak ada"). */
export function isianBermakna(teks: string | undefined): boolean {
  return !ISIAN_KOSONG.test(norm(teks))
}

/**
 * v2.13 — alasan satu baris: kolom Alasan, kolom alasan tambahan, dan teks
 * alasan di kolom Jam pulang (Form lama: "Pulang duluan (alasan + jam)").
 * Isian pengisi dibuang, yang sama tidak diulang, sisanya digabung " / ".
 * Form gabungan (satu kolom Alasan, Jam pulang berisi jam) tidak berubah.
 */
export function alasanIsian(b: string[], peta: PetaKolomGForm): string {
  const ambil = (i: number) => (i >= 0 ? (b[i] ?? '').trim() : '')
  const calon = [peta.alasan, ...(peta.alasanLain ?? [])].map(ambil)
  const pulang = ambil(peta.pulang)
  if (/[a-z]{3,}/i.test(pulang.replace(/\b(jam|pukul|wib)\b/gi, ''))) calon.push(pulang)
  const terlihat = new Set<string>()
  const hasil: string[] = []
  for (const x of calon) {
    const n = norm(x)
    if (ISIAN_KOSONG.test(n) || terlihat.has(n)) continue
    terlihat.add(n)
    hasil.push(x)
  }
  return hasil.join(' / ')
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

/** Hasil baca jam: menit sejak 00.00, dan apakah AM/PM ditulis (jam 12-an jadi pasti). */
export interface JamTerbaca {
  menit: number
  ampm: boolean
}

const KATA_JAM = 'jam|jm|pukul|pkl|pk|datang|tiba|sampai|menyusul|nyusul|pulang|balik'

/**
 * v2.15 — jam dari teks bebas. Urutan pencarian:
 *  1. jam bermenit ("18.45", "18:45:10", "6:45 PM");
 *  2. angka sesudah kata jam ("jm 6", "pukul 7 malam", "menyusul 18");
 *  3. sel yang isinya hanya angka jam ("18", "6 pm").
 * Angka lain diabaikan: "setelah sesi 4 menyusul jm 6" dulu terbaca 04.00.
 * Bila ada beberapa jam, `pilih` menentukan yang dipakai — "kelas selesai
 * 18:30, menyusul 18:40": jam datang = yang terakhir.
 */
export function bacaJamTeks(teks: string, pilih: 'awal' | 'akhir' = 'awal'): JamTerbaca | null {
  const t = teks
    .toLowerCase()
    .replace(/\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[/-]\d{1,2}[/-]\d{2,4}/g, ' ')
    .replace(/\b(sesi|lantai|ruang|gedung|nomor|no|angkatan)\s*-?\s*\d+(?![\d:.])/g, ' ')
  const jadi = (h: number, mm: number, ap: string | undefined, malam = false): JamTerbaca | null => {
    if (ap === 'pm' && h < 12) h += 12
    if (ap === 'am' && h === 12) h = 0
    if (!ap && malam && h < 12) h += 12
    if (h > 23 || mm > 59) return null
    return { menit: h * 60 + mm, ampm: !!ap || malam }
  }
  const ambil = (daftar: JamTerbaca[]) => (daftar.length ? daftar[pilih === 'akhir' ? daftar.length - 1 : 0] : null)
  const malam = (sisa: string) => /^\s*(malam|sore|petang)\b/.test(sisa)
  const bermenit: JamTerbaca[] = []
  for (const m of t.matchAll(/(?<!\d)(?<!\d[.:])(\d{1,2})[:.](\d{2})(?:[:.]\d{2}(?:\.\d+)?)?(?!\d|[.:]\d)\s*(am|pm)?/g)) {
    const j = jadi(Number(m[1]), Number(m[2]), m[3], malam(t.slice(m.index! + m[0].length)))
    if (j) bermenit.push(j)
  }
  if (bermenit.length) return ambil(bermenit)
  const berkata: JamTerbaca[] = []
  for (const m of t.matchAll(new RegExp(`\\b(?:${KATA_JAM})\\s*(?:jam|jm|pukul|pkl)?\\s*(\\d{1,2})(?!\\d|[.:]\\d)\\s*(am|pm)?`, 'g'))) {
    const j = jadi(Number(m[1]), 0, m[2], malam(t.slice(m.index! + m[0].length)))
    if (j) berkata.push(j)
  }
  if (berkata.length) return ambil(berkata)
  const polos = t.match(/^\s*(\d{1,2})\s*(am|pm)?\s*(wib)?\s*$/)
  return polos ? jadi(Number(polos[1]), 0, polos[2]) : null
}

/** Jam → menit sejak tengah malam. "18.45", "18:45:10", "6:45 PM", "18", "jm 6" (→ 06.00; lihat `jamUntukSesi`). */
export function bacaJamForm(teks: string, pilih: 'awal' | 'akhir' = 'awal'): number | null {
  return bacaJamTeks(teks, pilih)?.menit ?? null
}

/**
 * v2.15 — jam dari isian untuk sesi tertentu. Jam 1–11 tanpa AM/PM pada sesi
 * sore/malam (mulai ≥ 12.00) dibaca sebagai jam sore: "jm 6" → 18.00,
 * "7.15" → 19.15. Jam 24-an ("18.05") dan sesi pagi tidak diubah.
 */
export function jamUntukSesi(teks: string, sesi: Pick<Session, 'startTime'> | null, pilih: 'awal' | 'akhir' = 'awal'): number | null {
  const j = bacaJamTeks(teks, pilih)
  if (!j) return null
  const mulai = Number((sesi?.startTime ?? '').split(':')[0])
  if (!j.ampm && sesi && Number.isFinite(mulai) && mulai >= 12 && j.menit >= 60 && j.menit < 12 * 60) return j.menit + 12 * 60
  return j.menit
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

/**
 * Kata kunci per kategori bawaan — kategori tambahan pelatih dicocokkan lewat
 * namanya. Dicocokkan per KATA UTUH (teks sudah dinormalisasi: huruf kecil,
 * tanda baca jadi spasi). v2.11.1: sebelumnya potongan kata ikut cocok —
 * "kel·om·pok", "k·om·unitas", "welc·om", "kerk·om" terbaca "om" sehingga izin
 * LDPKM, acara komunitas, dan kerja kelompok jatuh ke "Orang tua berkunjung".
 */
const KATA_KATEGORI: Record<string, RegExp> = {
  sakit:
    /\b(sakit|dokter|demam|opname|rawat inap|klinik|rumah sakit|rs|puskesmas|enak badan|kurang fit|meriang|pusing|flu|tipes|tifus|maag|diare|muntah)\b/,
  ortu: /\b(orang ?tua|ortu|ayah|ibu|bapak|mama|papa|om|tante|kakek|nenek|wali|keluarga datang|dikunjungi|berkunjung)\b/,
  kuliah: /\b(praktikum|asistensi|asisten|responsi|kuliah|kelas pengganti|ujian|kuis|quiz|uts|uas)\b/,
  agama: /\b(ibadah|gereja|misa|keagamaan|retret|retreat|pengajian|sembahyang|pura|vihara|jumatan|doa)\b/,
  duka: /\b(duka|berduka|meninggal|wafat|melayat|layat|pemakaman)\b/,
  lomba: /\b(lomba|pomda|porda|kejuaraan|pertandingan|olimpiade|mewakili)\b/,
  organisasi: /\b(bem|hima|ukm|organisasi|kepanitiaan|panitia|event)\b/,
}

/**
 * Urutan pemeriksaan kata kunci: yang paling khas dulu. "Orang tua" paling
 * akhir karena kata-katanya paling umum ("ibu dosen", "bapak asisten").
 */
const URUTAN_KATA = ['sakit', 'duka', 'lomba', 'kuliah', 'agama', 'organisasi', 'ortu']

/**
 * Tebak kategori dari jawaban. Nama kategori yang persis/terkandung menang;
 * lalu kata kunci. `lain` = ada jawaban tapi tidak cocok; `undefined` = kosong.
 * "Rapat" organisasi bukan izin — sengaja jatuh ke `lain`. Kegiatan wajib
 * mahasiswa baru (LDPKM, Pra LDK, PKKMB…) juga `lain`: belum ada kategorinya,
 * jadi danlat yang memutus per orang.
 */
export function tebakKategoriIzin(teks: string, daftar: readonly KategoriIzin[]): string | undefined {
  const t = norm(teks)
  if (!t) return undefined
  for (const k of daftar) {
    const n = norm(k.nama)
    if (n && (t === n || t.startsWith(n) || (n.length >= 6 && t.includes(n)))) return k.id
  }
  if (/\brapat\b/.test(t) && !KATA_KATEGORI.sakit.test(t)) return 'lain'
  const peringkat = (id: string) => {
    const i = URUTAN_KATA.indexOf(id)
    return i < 0 ? URUTAN_KATA.length : i
  }
  for (const k of [...daftar].sort((a, b) => peringkat(a.id) - peringkat(b.id))) {
    const pola = KATA_KATEGORI[k.id]
    if (pola?.test(t)) return k.id
  }
  return 'lain'
}

/* ------------------------------ status isian ------------------------------ */

export type StatusIsianForm = 'hadir' | 'telat' | 'pulang' | 'izin' | 'sakit'

/**
 * v2.10.1 — baca jawaban kolom Status ("Hadir", "Izin", "Sakit", "Datang
 * terlambat", "Pulang lebih awal"…). `null` = kosong atau tidak dikenali —
 * baris seperti itu diperlakukan seperti sebelum ada kolom Status.
 */
export function bacaStatusIsian(teks: string): StatusIsianForm | null {
  const t = norm(teks)
  if (!t) return null
  if (/(sakit|\bs\b)/.test(t)) return 'sakit'
  if (/(izin|ijin|\bi\b|tidak hadir|berhalangan)/.test(t)) return 'izin'
  if (/(pulang|\btp\b)/.test(t)) return /(telat|terlambat)/.test(t) ? 'telat' : 'pulang'
  if (/(telat|terlambat)/.test(t)) return 'telat'
  if (/(hadir|datang|\bh\b|^ya\b)/.test(t)) return 'hadir'
  return null
}

/**
 * v2.13 — keterangan telat/pulang awal dari satu isian Form gabungan
 * (jenis presensi). `null` bila statusnya bukan telat/pulang atau tidak ada
 * yang bisa dicatat (alasan, bukti, rencana jam).
 */
export function keteranganIsian(
  teksStatus: string,
  capWaktu: number,
  isi: { alasan?: string; bukti?: string; jamDatang?: number | null; jamPulang?: number | null; pulangDiisi?: boolean },
): KeteranganForm | null {
  let st = bacaStatusIsian(teksStatus)
  // v2.15 — Form P4: anak yang pulang duluan memilih "Hadir Tepat Waktu" lalu
  // mengisi kolom Pulang duluan. Kolom itu yang menentukan, bukan Status.
  if (isi.pulangDiisi && (st === 'hadir' || st === null)) st = 'pulang'
  if (st !== 'telat' && st !== 'pulang') return null
  const t = norm(teksStatus)
  const status: KeteranganForm['status'] =
    st === 'pulang' ? 'pulang' : /pulang/.test(t) || isi.pulangDiisi ? 'telat-pulang' : 'telat'
  const k: KeteranganForm = { status, capWaktu }
  if (isi.alasan?.trim()) k.alasan = isi.alasan.trim()
  if (isi.bukti?.trim()) k.bukti = isi.bukti.trim()
  if (isi.jamDatang != null && status !== 'pulang') k.jamDatang = isi.jamDatang
  if (isi.jamPulang != null && status !== 'telat') k.jamPulang = isi.jamPulang
  return k.alasan || k.bukti || k.jamDatang != null || k.jamPulang != null ? k : null
}

const samaKeterangan = (a: KeteranganForm | undefined, b: KeteranganForm) =>
  !!a && a.status === b.status && a.alasan === b.alasan && a.bukti === b.bukti && a.jamDatang === b.jamDatang && a.jamPulang === b.jamPulang

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
  /** v2.10.1 — menit sejak tengah malam (jenis `datang`). */
  jamPulang: number | null
  /** v2.10.1 — jawaban kolom Status yang terbaca. */
  status: StatusIsianForm | null
  kategori?: string
  alasan: string
  bukti: string
  /** v2.13 — keterangan telat/pulang awal (jenis presensi, Form gabungan). */
  keterangan?: KeteranganForm
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
    const alasan = alasanIsian(b, o.peta)
    const bukti = sel(b, o.peta.bukti)
    const sesi = o.sesiTetap ? (perSesi.get(o.sesiTetap) ?? null) : sesiUntukIsian(o.jenis, capWaktu, tanggal, o.sesi)
    // v2.15 — jam dibaca menurut sesinya ("jm 6" pada latihan malam = 18.00).
    const jamDatang = o.peta.jam >= 0 ? jamUntukSesi(sel(b, o.peta.jam), sesi, 'akhir') : null
    const jamPulang = o.peta.pulang >= 0 ? jamUntukSesi(sel(b, o.peta.pulang), sesi) : null
    const pulangDiisi = o.peta.pulang >= 0 && isianBermakna(sel(b, o.peta.pulang))
    const status = o.peta.status >= 0 ? bacaStatusIsian(sel(b, o.peta.status)) : null
    const teksKategori = sel(b, o.peta.kategori) || alasan
    const kategori = o.jenis === 'izin' ? (status === 'sakit' && !sel(b, o.peta.kategori) ? 'sakit' : tebakKategoriIzin(teksKategori, o.kategori)) : undefined
    const cocok = cocokkanNamaForm(nama, o.anggota)
    const memberId = o.pilihan && no in o.pilihan ? o.pilihan[no] : cocok.memberId
    // v2.15 — Form tanpa kolom jam datang (Form P4): jam menyusul ditulis di kolom
    // "Alasan Datang Terlambat (+ Jam Menyusul)". Hanya untuk keterangan telat;
    // jam hadir tetap dari absen fisik.
    const jamKet =
      jamDatang ?? (o.jenis === 'presensi' && o.peta.jam < 0 && o.peta.alasan >= 0 && status === 'telat' ? jamUntukSesi(sel(b, o.peta.alasan), sesi, 'akhir') : null)
    const keterangan =
      o.jenis === 'presensi' && capWaktu != null
        ? (keteranganIsian(sel(b, o.peta.status), capWaktu, { alasan, bukti, jamDatang: jamKet, jamPulang, pulangDiisi }) ?? undefined)
        : undefined
    const dasar = { no, nama, cocok, memberId, sesiId: sesi?.id ?? null, capWaktu, jamDatang, jamPulang, status, kategori, alasan, bukti, ...(keterangan ? { keterangan } : {}) }
    const keluar = (aksi: AksiImpor, pesan: string) => hasil.push({ ...dasar, aksi, pesan })
    if (!nama) return keluar('lewati', 'Nama kosong')
    // v2.10.1 — satu Form untuk hadir & izin: kolom Status memilah barisnya.
    const isianIzin = status === 'izin' || status === 'sakit'
    if (o.jenis === 'izin' && status && !isianIzin) return keluar('lewati', 'Bukan isian izin/sakit (Status: hadir/telat/pulang)')
    if (o.jenis !== 'izin' && isianIzin) return keluar('lewati', `Isian ${status} — impor dengan jenis “Izin / sakit”`)
    if (!memberId) return keluar('lewati', cocok.kandidat.length ? 'Nama tidak pasti — pilih anggotanya' : 'Nama tidak dikenal')
    if (!sesi) return keluar('lewati', o.jenis === 'izin' ? 'Sesi tidak ditemukan — pakai kolom tanggal atau pilih sesi' : 'Tidak ada sesi yang cocok dengan cap waktunya')
    if ((o.jenis === 'presensi' || o.jenis === 'izin') && capWaktu == null) return keluar('lewati', 'Cap waktu tidak terbaca')
    const kunci = `${sesi.id}|${memberId}`
    // v2.13 — isian kedua yang membawa keterangan telat/pulang tetap dipakai (keterangannya saja).
    if (terlihat.has(kunci) && !(o.jenis === 'presensi' && keterangan)) return keluar('ganda', 'Isian ganda — hanya isian pertama yang dipakai')
    terlihat.add(kunci)
    const ada = peta.get(kunci)
    if (o.jenis === 'presensi') {
      const lama = sesi.formPresensi?.[memberId]
      const ketBaru = !!keterangan && !samaKeterangan(sesi.formKeterangan?.[memberId], keterangan)
      const lengkapiHadir =
        !!keterangan && ada?.status === 'hadir' && ((!!keterangan.alasan && !ada.alasanTelat) || (!!keterangan.bukti && !ada.bukti))
      if (lama != null && lama <= capWaktu! && !ketBaru && !lengkapiHadir) return keluar('sama', 'Sudah tercatat')
      const ket = keterangan ? ` · keterangan ${keterangan.status === 'pulang' ? 'pulang awal' : keterangan.status === 'telat' ? 'telat' : 'telat & pulang awal'}` : ''
      return keluar(lama != null ? 'perbarui' : 'tambah', `${ada ? `Catatan absen: ${ada.status}` : 'Belum ada catatan absen fisik'}${ket}`)
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
    const pulangAt = jamPulang != null ? msSesi(sesi, `${Math.floor(jamPulang / 60)}:${jamPulang % 60}`) : undefined
    const dariForm = lengkapiDariForm(ada, sesi)
    const beda =
      (datangAt != null && ada.datangAt !== datangAt) ||
      (pulangAt != null && ada.pulangAt !== pulangAt) ||
      (!!alasan && ada.alasanTelat !== alasan) ||
      (!!bukti && ada.bukti !== bukti) ||
      (!alasan && !!dariForm.alasanTelat) ||
      (!bukti && !!dariForm.bukti)
    return keluar(beda ? 'perbarui' : 'sama', beda ? 'Perbarui jam datang/pulang/alasan' : 'Sudah tercatat')
  })
  return hasil
}

export interface HasilTerapForm {
  catatan: AttendanceRecord[]
  /** sessionId → formPresensi baru (utuh). */
  form: Record<string, Record<string, number>>
  /** v2.13 — sessionId → formKeterangan baru (utuh). */
  keterangan: Record<string, Record<string, KeteranganForm>>
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
  const keterangan: Record<string, Record<string, KeteranganForm>> = {}
  let jumlah = 0
  for (const b of rencana) {
    if ((b.aksi !== 'tambah' && b.aksi !== 'perbarui') || !b.memberId || !b.sesiId) continue
    const s = perSesi.get(b.sesiId)
    if (!s) continue
    jumlah++
    if (jenis === 'presensi') {
      const f = (form[s.id] ??= { ...(s.formPresensi ?? {}) })
      f[b.memberId] = Math.min(f[b.memberId] ?? Infinity, b.capWaktu!)
      if (b.keterangan) {
        // Disimpan di sesi (dipakai saat absen fisiknya masuk) dan, bila anak
        // sudah tercatat hadir, langsung melengkapi alasan & buktinya.
        const k = (keterangan[s.id] ??= { ...(s.formKeterangan ?? {}) })
        k[b.memberId] = b.keterangan
        const kunci = `${s.id}|${b.memberId}`
        const ada = peta.get(kunci)
        if (ada?.status === 'hadir') {
          const tambah = lengkapiDariForm(ada, { formKeterangan: { [b.memberId]: b.keterangan } })
          if (Object.keys(tambah).length) {
            const r = { ...ada, ...tambah }
            peta.set(kunci, r)
            const i = keluar.findIndex((x) => x.id === r.id)
            if (i >= 0) keluar[i] = r
            else keluar.push(r)
          }
        }
      }
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
      delete r.pulangAt
      delete r.alasanTelat
      keluar.push(r)
      continue
    }
    const r: AttendanceRecord = {
      ...(ada ?? { id: buatId(), sessionId: s.id, memberId: b.memberId }),
      status: 'hadir',
    }
    if (b.jamDatang != null) r.datangAt = msSesi(s, `${Math.floor(b.jamDatang / 60)}:${b.jamDatang % 60}`)
    if (b.jamPulang != null) r.pulangAt = msSesi(s, `${Math.floor(b.jamPulang / 60)}:${b.jamPulang % 60}`)
    if (b.alasan) r.alasanTelat = b.alasan
    if (b.bukti) r.bukti = b.bukti
    Object.assign(r, lengkapiDariForm(r, s))
    delete r.dilaporAt
    delete r.kategoriIzin
    keluar.push(r)
  }
  return { catatan: keluar, form, keterangan, jumlah }
}

/** Ringkasan jumlah per aksi. */
export function ringkasRencanaForm(r: BarisRencanaForm[]): Record<AksiImpor, number> {
  const out: Record<AksiImpor, number> = { tambah: 0, perbarui: 0, sama: 0, bentrok: 0, ganda: 0, lewati: 0 }
  for (const b of r) out[b.aksi]++
  return out
}
