/**
 * #3 — Jadwal: kalender & agenda (logika murni, tanpa db/DOM).
 *
 * Semua tanggal ditangani sebagai string `YYYY-MM-DD` dan dihitung dengan
 * `Date` lokal pada **tengah hari**, supaya pergantian jam musim panas di
 * perangkat luar negeri tidak menggeser tanggal satu hari.
 *
 * Aturan yang dijaga:
 * - Minggu selalu dimulai **Senin** (kebiasaan Indonesia), termasuk saat
 *   bulan melintasi pergantian tahun.
 * - Seri mingguan berhenti **tepat** di tanggal akhir (inklusif), dan
 *   dibatasi `MAKS_SERI` supaya salah ketik tahun tidak membuat ribuan sesi.
 * - Menghapus seri **tidak pernah** menghapus sesi yang sudah punya absensi.
 * - Mengubah seri: *hanya sesi ini* melepaskan sesi dari seri;
 *   *semua berikutnya* hanya menyentuh sesi pada/sesudah tanggal sesi itu.
 */
import type { AttendanceRecord, Session } from '../db/types'

/* ----------------------------- tanggal ----------------------------- */

const dua = (n: number) => String(n).padStart(2, '0')

export function keTanggal(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number)
  return new Date(y, (m || 1) - 1, d || 1, 12)
}

export function keISO(d: Date): string {
  return `${d.getFullYear()}-${dua(d.getMonth() + 1)}-${dua(d.getDate())}`
}

export function tambahHari(iso: string, n: number): string {
  const d = keTanggal(iso)
  d.setDate(d.getDate() + n)
  return keISO(d)
}

/** Selisih hari b − a. */
export function selisihHari(a: string, b: string): number {
  return Math.round((keTanggal(b).getTime() - keTanggal(a).getTime()) / 86_400_000)
}

/** 0 = Senin … 6 = Minggu. */
export function hariSenin(iso: string): number {
  return (keTanggal(iso).getDay() + 6) % 7
}

export const NAMA_HARI_SENIN = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min']
export const NAMA_HARI_PANJANG = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu']
export const NAMA_BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/** Awal minggu (Senin) dari sebuah tanggal. */
export function awalMinggu(iso: string): string {
  return tambahHari(iso, -hariSenin(iso))
}

/** `"2026-09"` → `{ tahun, bulan }` (bulan 1–12). */
export function geserBulan(tahun: number, bulan: number, n: number): { tahun: number; bulan: number } {
  const t = tahun * 12 + (bulan - 1) + n
  return { tahun: Math.floor(t / 12), bulan: (t % 12) + 1 }
}

export interface SelKalender {
  tanggal: string
  /** tanggal ini termasuk bulan yang sedang ditampilkan */
  bulanIni: boolean
}

/**
 * Kotak bulan: baris-baris minggu (7 sel, mulai Senin) yang menutup seluruh
 * bulan. Sel di luar bulan tetap ada (diberi `bulanIni: false`) supaya
 * kotaknya rata.
 */
export function susunBulan(tahun: number, bulan: number): SelKalender[][] {
  const awal = `${tahun}-${dua(bulan)}-01`
  const jumlahHari = new Date(tahun, bulan, 0).getDate()
  const akhir = `${tahun}-${dua(bulan)}-${dua(jumlahHari)}`
  const minggu: SelKalender[][] = []
  let t = awalMinggu(awal)
  while (selisihHari(t, akhir) >= 0) {
    const baris: SelKalender[] = []
    for (let i = 0; i < 7; i++) {
      baris.push({ tanggal: t, bulanIni: t.slice(0, 7) === awal.slice(0, 7) })
      t = tambahHari(t, 1)
    }
    minggu.push(baris)
  }
  return minggu
}

/** Kelompokkan sesi per tanggal, terurut menurut jam mulai. */
export function sesiPerTanggal(sesi: Session[]): Map<string, Session[]> {
  const m = new Map<string, Session[]>()
  for (const s of sesi) {
    const a = m.get(s.date)
    if (a) a.push(s)
    else m.set(s.date, [s])
  }
  for (const a of m.values()) a.sort((x, y) => (x.startTime || '').localeCompare(y.startTime || ''))
  return m
}

/* ----------------------------- ringkasan ----------------------------- */

export interface RingkasSesi {
  /** jumlah catatan hadir / jumlah catatan absensi; null bila belum ada absensi */
  persenHadir: number | null
  jumlahAbsensi: number
  checklistSelesai: number
  checklistTotal: number
  adaRencana: boolean
  adaSetList: boolean
}

/**
 * Ringkasan kecil untuk label sesi di kalender. Persentase kehadiran hanya
 * dihitung dari catatan yang ada — sesi tanpa absensi memberi `null`, bukan
 * 0%, supaya "belum diabsen" tidak tampak seperti "semua bolos".
 */
export function ringkasSesi(s: Session, absensi: AttendanceRecord[]): RingkasSesi {
  const milik = absensi.filter((a) => a.sessionId === s.id)
  const hadir = milik.filter((a) => a.status === 'hadir').length
  return {
    persenHadir: milik.length ? Math.round((hadir / milik.length) * 100) : null,
    jumlahAbsensi: milik.length,
    checklistSelesai: s.checklist.filter((c) => c.done).length,
    checklistTotal: s.checklist.length,
    adaRencana: (s.rencanaLatihan?.length ?? 0) > 0,
    adaSetList: !!s.setListId,
  }
}

/** Nada warna kehadiran mengikuti ambang predikat J1. */
export function nadaKehadiran(persen: number, ambang: { baik: number; cukup: number }): 'baik' | 'cukup' | 'kurang' {
  return persen >= ambang.baik ? 'baik' : persen >= ambang.cukup ? 'cukup' : 'kurang'
}

/* ----------------------------- agenda ----------------------------- */

function kunciWaktu(s: Session): string {
  return `${s.date} ${s.startTime || '00:00'}`
}

/**
 * Sesi berikutnya: sesi pertama yang **belum selesai** (tanggal hari ini
 * dengan jam selesai yang belum lewat tetap dihitung).
 */
export function sesiBerikutnya(sesi: Session[], hariIni: string, jamSekarang: string): Session | null {
  const kandidat = sesi
    .filter((s) => s.date > hariIni || (s.date === hariIni && (s.endTime || '23:59') >= jamSekarang))
    .sort((a, b) => kunciWaktu(a).localeCompare(kunciWaktu(b)))
  return kandidat[0] ?? null
}

/** Penampilan terdekat (hari ini atau sesudahnya). */
export function penampilanTerdekat(sesi: Session[], hariIni: string): Session | null {
  return (
    sesi
      .filter((s) => s.type === 'penampilan' && s.date >= hariIni)
      .sort((a, b) => kunciWaktu(a).localeCompare(kunciWaktu(b)))[0] ?? null
  )
}

/** Teks hitung mundur: "hari ini", "besok", "3 hari lagi", "2 jam 15 menit lagi". */
export function teksHitungMundur(s: Session, sekarang: Date): string {
  const hariIni = keISO(sekarang)
  const n = selisihHari(hariIni, s.date)
  if (n > 1) return `${n} hari lagi`
  if (n === 1) return 'besok'
  if (n < 0) return `${-n} hari lalu`
  const [h, m] = (s.startTime || '00:00').split(':').map(Number)
  const mulai = h * 60 + m
  const kini = sekarang.getHours() * 60 + sekarang.getMinutes()
  const sisa = mulai - kini
  if (sisa <= 0) return 'sedang berlangsung / hari ini'
  const jam = Math.floor(sisa / 60)
  const mnt = sisa % 60
  return `${jam ? `${jam} jam ` : ''}${mnt} menit lagi`
}

export interface KelompokMinggu {
  awal: string
  label: string
  sesi: Session[]
}

/** Kelompokkan sesi (sudah tersaring) per minggu Senin–Minggu, terurut. */
export function kelompokPerMinggu(sesi: Session[], hariIni: string): KelompokMinggu[] {
  const urut = [...sesi].sort((a, b) => kunciWaktu(a).localeCompare(kunciWaktu(b)))
  const m = new Map<string, Session[]>()
  for (const s of urut) {
    const k = awalMinggu(s.date)
    const a = m.get(k)
    if (a) a.push(s)
    else m.set(k, [s])
  }
  const mingguIni = awalMinggu(hariIni)
  return [...m.entries()].map(([awal, isi]) => {
    const beda = selisihHari(mingguIni, awal) / 7
    const akhir = tambahHari(awal, 6)
    const rentang = `${labelPendek(awal)} – ${labelPendek(akhir)}`
    const label =
      beda === 0 ? `Minggu ini · ${rentang}` : beda === 1 ? `Minggu depan · ${rentang}` : beda === -1 ? `Minggu lalu · ${rentang}` : rentang
    return { awal, label, sesi: isi }
  })
}

export function labelPendek(iso: string): string {
  const d = keTanggal(iso)
  return `${d.getDate()} ${NAMA_BULAN[d.getMonth()].slice(0, 3)}`
}

/* ----------------------------- seri mingguan ----------------------------- */

/** Batas jumlah sesi dalam satu seri — pengaman salah ketik tahun. */
export const MAKS_SERI = 200

export interface AturanSeri {
  /** hari dalam minggu, 0 = Senin … 6 = Minggu */
  hari: number[]
  /** tanggal mulai (inklusif) */
  mulai: string
  /** tanggal akhir (inklusif) */
  akhir: string
}

/** Tanggal-tanggal yang dihasilkan aturan seri, terurut, maks `MAKS_SERI`. */
export function tanggalSeri(a: AturanSeri): string[] {
  const hari = new Set(a.hari)
  const hasil: string[] = []
  if (!hari.size || selisihHari(a.mulai, a.akhir) < 0) return hasil
  for (let t = a.mulai; selisihHari(t, a.akhir) >= 0 && hasil.length < MAKS_SERI; t = tambahHari(t, 1)) {
    if (hari.has(hariSenin(t))) hasil.push(t)
  }
  return hasil
}

/** Salinan sesi untuk tanggal lain: id baru, checklist belum dicentang, penanda nyata dikosongkan. */
export function salinSesi(s: Session, tanggal: string, buatId: () => string, sekarangMs = Date.now()): Session {
  const salin: Session = JSON.parse(JSON.stringify(s))
  salin.id = buatId()
  salin.date = tanggal
  salin.createdAt = sekarangMs
  salin.checklist = salin.checklist.map((c) => ({ ...c, done: 0 }))
  delete salin.realisasiLatihan
  delete salin.mulaiNyata
  delete salin.selesaiNyata
  delete salin.seriId
  return salin
}

/**
 * Bangun seri dari sesi contoh. Sesi contoh sendiri ikut menjadi anggota
 * seri bila tanggalnya jatuh pada aturan; kalau tidak, ia tetap disimpan
 * apa adanya dan seri dibuat untuk tanggal-tanggal aturan saja.
 */
export function buatSeri(
  contoh: Session,
  aturan: AturanSeri,
  buatId: () => string,
  seriId: string,
  sekarangMs = Date.now(),
): Session[] {
  const tanggal = tanggalSeri(aturan)
  const hasil: Session[] = []
  for (const t of tanggal) {
    if (t === contoh.date) hasil.push({ ...contoh, seriId })
    else hasil.push({ ...salinSesi(contoh, t, buatId, sekarangMs), seriId })
  }
  if (!tanggal.includes(contoh.date)) hasil.unshift({ ...contoh })
  return hasil
}

/** Bidang yang ikut berubah saat "ubah semua berikutnya". Tanggal tidak termasuk. */
const BIDANG_SERI = ['title', 'type', 'startTime', 'endTime', 'place', 'notes', 'checklist', 'rencanaLatihan', 'setListId'] as const

/**
 * Terapkan perubahan sesi `baru` ke seri.
 * - `'ini'`: hanya sesi ini, dan sesi itu **dilepas** dari seri.
 * - `'berikutnya'`: sesi ini + sesi seri yang sama pada/sesudah tanggal
 *   **asli**-nya. Status centang checklist tiap sesi dipertahankan bila
 *   teks butirnya sama.
 * Mengembalikan sesi-sesi yang perlu disimpan.
 */
export function ubahSeri(semua: Session[], lama: Session, baru: Session, cakupan: 'ini' | 'berikutnya'): Session[] {
  if (cakupan === 'ini' || !lama.seriId) {
    const s = { ...baru }
    if (cakupan === 'ini') delete s.seriId
    return [s]
  }
  const hasil: Session[] = [{ ...baru, seriId: lama.seriId }]
  for (const s of semua) {
    if (s.id === lama.id || s.seriId !== lama.seriId || s.date < lama.date) continue
    const u: Session = { ...s }
    for (const k of BIDANG_SERI) {
      ;(u as unknown as Record<string, unknown>)[k] = JSON.parse(JSON.stringify(baru[k] ?? null)) ?? undefined
    }
    const doneLama = new Map(s.checklist.map((c) => [c.text, c.done]))
    u.checklist = (baru.checklist ?? []).map((c) => ({ ...c, done: doneLama.get(c.text) ?? 0 }))
    hasil.push(u)
  }
  return hasil
}

export interface RencanaHapusSeri {
  hapus: string[]
  /** sesi yang dipertahankan karena sudah punya absensi */
  dipertahankan: string[]
}

/** Rencana menghapus seri (opsional mulai tanggal tertentu). Sesi berabsensi tidak pernah dihapus. */
export function rencanaHapusSeri(
  semua: Session[],
  seriId: string,
  absensi: AttendanceRecord[],
  mulai?: string,
): RencanaHapusSeri {
  const berabsen = new Set(absensi.map((a) => a.sessionId))
  const hapus: string[] = []
  const dipertahankan: string[] = []
  for (const s of semua) {
    if (s.seriId !== seriId || (mulai && s.date < mulai)) continue
    ;(berabsen.has(s.id) ? dipertahankan : hapus).push(s.id)
  }
  return { hapus, dipertahankan }
}

/* ----------------------------- ekspor ----------------------------- */

/** Warna hex per jenis — untuk cetak (tanpa oklch). */
export const WARNA_JENIS_HEX: Record<string, { bg: string; fg: string }> = {
  latihan: { bg: '#d1fae5', fg: '#065f46' },
  section: { bg: '#cffafe', fg: '#155e75' },
  gabungan: { bg: '#ede9fe', fg: '#5b21b6' },
  penampilan: { bg: '#fef3c7', fg: '#92400e' },
  rapat: { bg: '#e0f2fe', fg: '#075985' },
  lainnya: { bg: '#f1f5f9', fg: '#334155' },
}

const esc = (t: string) =>
  String(t ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** HTML cetak kalender satu bulan (A4 mendatar, warna hex). */
export function htmlKalenderBulan(
  tahun: number,
  bulan: number,
  sesi: Session[],
  opts: { namaTim?: string; label?: (type: string) => string } = {},
): string {
  const per = sesiPerTanggal(sesi)
  const minggu = susunBulan(tahun, bulan)
  const label = opts.label ?? ((t: string) => t)
  const baris = minggu
    .map(
      (m) =>
        '<tr>' +
        m
          .map((sel) => {
            const isi = (per.get(sel.tanggal) ?? [])
              .map((s) => {
                const w = WARNA_JENIS_HEX[s.type] ?? WARNA_JENIS_HEX.lainnya
                return `<div class="s" style="background:${w.bg};color:${w.fg}"><b>${esc(s.startTime)}</b> ${esc(s.title)}<br><span>${esc(label(s.type))}${s.place ? ` · ${esc(s.place)}` : ''}</span></div>`
              })
              .join('')
            return `<td class="${sel.bulanIni ? '' : 'luar'}"><div class="t">${Number(sel.tanggal.slice(8))}</div>${isi}</td>`
          })
          .join('') +
        '</tr>',
    )
    .join('')
  const judul = `Jadwal ${NAMA_BULAN[bulan - 1]} ${tahun}`
  return `<!doctype html><html lang="id"><head><meta charset="utf-8"><title>${esc(judul)}</title>
<style>
@page { size: A4 landscape; margin: 10mm; }
body { font-family: Arial, Helvetica, sans-serif; color: #0f172a; margin: 0; }
h1 { font-size: 18px; margin: 0 0 2px; } p.tim { margin: 0 0 8px; color: #475569; font-size: 12px; }
table { width: 100%; border-collapse: collapse; table-layout: fixed; }
th { background: #334155; color: #ffffff; font-size: 11px; padding: 4px; }
td { border: 1px solid #cbd5e1; vertical-align: top; height: 80px; padding: 3px; font-size: 10px; }
td.luar { background: #f8fafc; color: #94a3b8; }
.t { font-weight: bold; font-size: 11px; margin-bottom: 2px; }
.s { border-radius: 3px; padding: 2px 3px; margin-bottom: 2px; line-height: 1.25; }
.s span { font-size: 9px; }
</style></head><body>
<h1>${esc(judul)}</h1>${opts.namaTim ? `<p class="tim">${esc(opts.namaTim)}</p>` : ''}
<table><thead><tr>${NAMA_HARI_PANJANG.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${baris}</tbody></table>
</body></html>`
}

/**
 * Satu berkas .ics berisi banyak sesi. Memakai `bangunICS` per sesi lalu
 * menggabungkan VEVENT-nya dalam satu VCALENDAR.
 */
export function gabungICS(potongan: string[]): string {
  const events: string[] = []
  for (const p of potongan) {
    const a = p.indexOf('BEGIN:VEVENT')
    const b = p.lastIndexOf('END:VEVENT')
    if (a >= 0 && b > a) events.push(p.slice(a, b + 'END:VEVENT'.length))
  }
  return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//DrillKit//Jadwal//ID', ...events, 'END:VCALENDAR'].join('\r\n') + '\r\n'
}

/* ----------------------------- pilihan tampilan ----------------------------- */

/** `daftar` = tampilan lama (semua kartu terbuka), tetap tersedia. */
export type TampilanJadwal = 'bulan' | 'agenda' | 'daftar'
export const KUNCI_TAMPILAN = 'drillkit.jadwal.tampilan'

/** Bawaan: kalender di layar lebar, agenda di HP. Pilihan tersimpan menang. */
export function tampilanAwal(tersimpan: string | null, lebarLayar: number): TampilanJadwal {
  if (tersimpan === 'bulan' || tersimpan === 'agenda' || tersimpan === 'daftar') return tersimpan
  return lebarLayar >= 768 ? 'bulan' : 'agenda'
}
