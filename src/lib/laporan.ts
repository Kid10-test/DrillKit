/**
 * D4 — Paket laporan admin.
 *
 * Menyusun berkas-berkas "siap serah" dari data absensi yang sedang disaring
 * di tab Rekap:
 *
 *   1. **Laporan bulanan** — kepala (nama tim, logo, periode), ringkasan angka,
 *      kalimat ringkasan otomatis, tabel per section / per jenis kegiatan /
 *      per anggota, daftar perlu perhatian, dan ruang tanda tangan.
 *   2. **Kartu kehadiran per anggota** — satu kartu per anggota berisi identitas,
 *      ringkasan H/I/S/A, rincian tiap sesi, dan garis tanda tangan.
 *   3. **CSV matriks & CSV ringkas** — enak dibuka di Excel, termasuk di HP.
 *
 * Semua HTML disusun di sini (bukan di komponen) supaya logika cetaknya bisa
 * dipakai ulang dan mudah diubah tanpa menyentuh antarmuka. Warna selalu hex
 * murni — aman untuk browser lama di laptop portabel.
 */

import type { AmbangPredikat, AttendanceRecord, AttendanceStatus, Member, Session } from '../db/types'
import { ROLE_LABEL, formatDateShort, pct, sectionLabel, sesiMeta, toCSV, downloadFile } from './utils'
import { URUTAN_JENIS } from './utils'
import { downloadHtmlFile, esc, printHtml, printShell } from './print'

export const URUT_STATUS: AttendanceStatus[] = ['hadir', 'izin', 'sakit', 'alpha']

const LABEL_STATUS: Record<AttendanceStatus, string> = {
  hadir: 'Hadir',
  izin: 'Izin',
  sakit: 'Sakit',
  alpha: 'Tanpa keterangan',
}

const SINGKAT_STATUS: Record<AttendanceStatus, string> = {
  hadir: 'H',
  izin: 'I',
  sakit: 'S',
  alpha: 'A',
}

/** Warna hex murni — dipakai di HTML cetak, jadi tidak boleh `oklch()`/`color-mix()`. */
const WARNA_STATUS: Record<AttendanceStatus, string> = {
  hadir: '#10b981',
  izin: '#38bdf8',
  sakit: '#f59e0b',
  alpha: '#f43f5e',
}

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/* -------------------------------- Predikat --------------------------------- */

/** Ambang bawaan — sama persis dengan angka yang dulu tertanam di kode (D4). */
export const PREDIKAT_BAKU: AmbangPredikat = { baik: 85, cukup: 70 }

/**
 * J1 — rapikan ambang predikat dari pengaturan.
 *
 * Nilainya diketik tangan, jadi harus tahan salah ketik: di luar 0–100
 * dijepit, pecahan dibulatkan (persen kehadiran selalu bilangan bulat, lihat
 * `pct`), yang bukan angka kembali ke bawaan, dan urutan terbalik
 * (Cukup > Baik) ditukar. Tanpa penukaran itu, `baik 70 / cukup 85`
 * membuat predikat "Cukup" mustahil diraih — anggota 80% langsung jatuh ke
 * "Perlu perhatian" tanpa ada yang mengerti mengapa.
 */
export function rapikanPredikat(a?: Partial<AmbangPredikat> | null): AmbangPredikat {
  const angka = (v: unknown, bawaan: number) => {
    const n = typeof v === 'number' ? v : Number.NaN
    return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : bawaan
  }
  const baik = angka(a?.baik, PREDIKAT_BAKU.baik)
  const cukup = angka(a?.cukup, PREDIKAT_BAKU.cukup)
  return baik >= cukup ? { baik, cukup } : { baik: cukup, cukup: baik }
}

/** Predikat satu anggota. `terisi` 0 → "Belum ada catatan", bukan "Perlu perhatian". */
export function predikatKehadiran(
  b: { terisi: number; rate: number },
  ambang?: Partial<AmbangPredikat> | null,
): string {
  if (b.terisi === 0) return 'Belum ada catatan'
  const a = rapikanPredikat(ambang)
  return b.rate >= a.baik ? 'Baik' : b.rate >= a.cukup ? 'Cukup' : 'Perlu perhatian'
}

/**
 * Keterangan ambang yang ikut tercetak, mis. "Baik ≥ 85% · Cukup 70–84% ·
 * Perlu perhatian < 70%". Pembina yang membaca kartu perlu tahu arti
 * "Cukup" di tim ini — begitu ambangnya bisa diatur, kata itu sendiri tidak
 * lagi menjelaskan apa pun.
 */
export function teksAmbangPredikat(ambang?: Partial<AmbangPredikat> | null): string {
  const a = rapikanPredikat(ambang)
  const bagian = [`Baik ≥ ${a.baik}%`]
  if (a.cukup < a.baik) {
    bagian.push(a.baik - 1 === a.cukup ? `Cukup ${a.cukup}%` : `Cukup ${a.cukup}–${a.baik - 1}%`)
  }
  if (a.cukup > 0) bagian.push(`Perlu perhatian < ${a.cukup}%`)
  return bagian.join(' · ')
}

/* ------------------------------- Data masuk -------------------------------- */

/** Semua yang dibutuhkan untuk menyusun laporan — sudah disaring periode/section/jenis. */
export interface DataLaporan {
  /** Nama tim untuk kepala laporan — diambil dari pengaturan. */
  namaTim: string
  /** Nama pelatih (pengaturan) — muncul di blok tanda tangan. */
  pelatih?: string
  /** Kota — dipakai pada baris tanggal cetak. */
  kota?: string
  /** Logo tim (data URL), opsional. */
  logo?: string
  /** Label periode yang mudah dibaca, mis. "September 2026" atau "Semua periode". */
  periode: string
  /** Kunci berkas, mis. "2026-09" atau "semua". */
  kunci: string
  anggota: Member[]
  sesi: Session[]
  catatan: AttendanceRecord[]
  /** Ambang kehadiran rendah (%) — ikut pilihan di tab Rekap. */
  batas: number
  /** Bulan pembanding dari tren D2 (opsional) — untuk kalimat ringkasan. */
  banding?: { label: string; rate: number } | null
  /** J1 — ambang predikat dari pengaturan tim; kosong = `PREDIKAT_BAKU`. */
  predikat?: AmbangPredikat
}

export interface BarisAnggota {
  member: Member
  counts: Record<AttendanceStatus, number>
  /** Jumlah sesi yang punya catatan untuk anggota ini. */
  terisi: number
  rate: number
  /** sessionId → status, supaya rincian kartu tidak perlu memindai ulang. */
  status: Map<string, AttendanceStatus>
  /** Keterangan yang ditulis pelatih saat mengisi absensi. */
  keterangan: { tanggal: string; judul: string; teks: string }[]
}

/** Susun baris per anggota — dipakai laporan, kartu, dan CSV. */
export function susunBaris(d: DataLaporan): BarisAnggota[] {
  const judul = new Map(d.sesi.map((s) => [s.id, s.title]))
  const tanggal = new Map(d.sesi.map((s) => [s.id, s.date]))
  const idSesi = new Set(d.sesi.map((s) => s.id))

  return d.anggota.map((member) => {
    const counts: Record<AttendanceStatus, number> = { hadir: 0, izin: 0, sakit: 0, alpha: 0 }
    const status = new Map<string, AttendanceStatus>()
    const keterangan: BarisAnggota['keterangan'] = []

    for (const r of d.catatan) {
      if (r.memberId !== member.id || !idSesi.has(r.sessionId)) continue
      counts[r.status]++
      status.set(r.sessionId, r.status)
      if (r.note?.trim()) {
        keterangan.push({
          tanggal: tanggal.get(r.sessionId) ?? '',
          judul: judul.get(r.sessionId) ?? '',
          teks: r.note.trim(),
        })
      }
    }

    const terisi = URUT_STATUS.reduce((a, k) => a + counts[k], 0)
    return { member, counts, terisi, rate: pct(counts.hadir, terisi), status, keterangan }
  })
}

export interface RingkasanLaporan {
  sesi: number
  anggota: number
  counts: Record<AttendanceStatus, number>
  terisi: number
  rate: number
  /** Anggota yang hadir di semua sesi yang tercatat untuknya (100%). */
  hadirPenuh: BarisAnggota[]
  /** Anggota di bawah ambang `batas`. */
  perhatian: BarisAnggota[]
  perSection: { id: string; label: string; anggota: number; counts: Record<AttendanceStatus, number>; terisi: number; rate: number }[]
  perJenis: { jenis: string; label: string; sesi: number; h: number; f: number; rate: number }[]
  /** Kalimat siap serah yang ditulis otomatis dari angka-angka di atas. */
  kalimat: string
}

/** Hitung ringkasan laporan: total, per section, per jenis, dan kalimat ringkasannya. */
export function susunRingkasan(d: DataLaporan, baris: BarisAnggota[]): RingkasanLaporan {
  const counts: Record<AttendanceStatus, number> = { hadir: 0, izin: 0, sakit: 0, alpha: 0 }
  for (const b of baris) for (const k of URUT_STATUS) counts[k] += b.counts[k]
  const terisi = URUT_STATUS.reduce((a, k) => a + counts[k], 0)
  const rate = pct(counts.hadir, terisi)

  // Per section
  const mapSection = new Map<string, RingkasanLaporan['perSection'][number]>()
  for (const b of baris) {
    const id = b.member.section
    let e = mapSection.get(id)
    if (!e) {
      e = { id, label: sectionLabel(id), anggota: 0, counts: { hadir: 0, izin: 0, sakit: 0, alpha: 0 }, terisi: 0, rate: 0 }
      mapSection.set(id, e)
    }
    e.anggota++
    for (const k of URUT_STATUS) e.counts[k] += b.counts[k]
  }
  const perSection = [...mapSection.values()].map((e) => {
    e.terisi = URUT_STATUS.reduce((a, k) => a + e.counts[k], 0)
    e.rate = pct(e.counts.hadir, e.terisi)
    return e
  }).sort((a, b) => b.rate - a.rate || a.label.localeCompare(b.label))

  // Per jenis kegiatan (D3)
  const jenisSesi = new Map(d.sesi.map((s) => [s.id, s.type]))
  const akum = new Map<string, { sesi: Set<string>; h: number; f: number }>()
  for (const r of d.catatan) {
    const t = jenisSesi.get(r.sessionId)
    if (!t) continue
    let e = akum.get(t)
    if (!e) {
      e = { sesi: new Set(), h: 0, f: 0 }
      akum.set(t, e)
    }
    e.sesi.add(r.sessionId)
    e.f++
    if (r.status === 'hadir') e.h++
  }
  const perJenis = URUTAN_JENIS.map((t) => {
    const e = akum.get(t)
    if (!e) return null
    return { jenis: t, label: sesiMeta(t).label, sesi: e.sesi.size, h: e.h, f: e.f, rate: pct(e.h, e.f) }
  }).filter((x): x is NonNullable<typeof x> => x !== null)

  const hadirPenuh = baris.filter((b) => b.terisi > 0 && b.rate === 100)
  const perhatian = baris.filter((b) => b.terisi > 0 && b.rate < d.batas).sort((a, b) => a.rate - b.rate)

  /* --------------------------- Kalimat otomatis --------------------------- */
  let kalimat = `Kehadiran ${d.periode}: ${rate}% (${counts.hadir} dari ${terisi} catatan) pada ${d.sesi.length} sesi yang diikuti ${d.anggota.length} anggota.`
  if (d.banding) {
    const delta = rate - d.banding.rate
    const arah = delta >= 3 ? 'naik' : delta <= -3 ? 'turun' : 'stabil'
    kalimat += ` Angka ini ${arah} ${Math.abs(delta)} poin dibanding ${d.banding.label} (${d.banding.rate}%).`
  }
  if (perhatian.length) {
    const contoh = perhatian.slice(0, 3).map((b) => `${b.member.name} ${b.rate}%`).join(', ')
    kalimat += ` ${perhatian.length} anggota perlu perhatian (di bawah ${d.batas}%): ${contoh}${perhatian.length > 3 ? ', dan lainnya' : ''}.`
  } else {
    kalimat += ` Tidak ada anggota di bawah ambang ${d.batas}%.`
  }
  if (hadirPenuh.length) kalimat += ` ${hadirPenuh.length} anggota hadir penuh di semua sesi yang tercatat.`

  return { sesi: d.sesi.length, anggota: d.anggota.length, counts, terisi, rate, hadirPenuh, perhatian, perSection, perJenis, kalimat }
}

/* --------------------------------- CSS ------------------------------------ */

/** CSS cetak bersama — A4, hex murni, tanpa font dari internet. */
function cssCetak(): string {
  return `
    @page { size: A4 portrait; margin: 14mm; }
    body { font-size: 11px; color:#000; }
    .kop { display:flex; align-items:center; gap:10px; border-bottom:2px solid #111; padding-bottom:8px; margin-bottom:10px; }
    .kop img { height:40px; width:auto; }
    .kop .nama { font-size:14px; font-weight:700; line-height:1.15; }
    .kop .sub { font-size:10px; color:#555; }
    h1.judul { font-size:15px; margin:0 0 2px; }
    .sub { font-size:10.5px; color:#555; margin:0 0 8px; }
    h2 { font-size:12px; margin:12px 0 5px; border-left:3px solid #111; padding-left:5px; }
    .tiles { display:flex; gap:6px; margin:8px 0 10px; }
    .tile { flex:1; border:1px solid #999; padding:5px 7px; }
    .tile span { display:block; font-size:9px; text-transform:uppercase; color:#555; }
    .tile b { font-size:14px; }
    table { width:100%; border-collapse:collapse; margin:4px 0 10px; }
    th, td { border:1px solid #999; padding:3px 5px; text-align:left; vertical-align:top; }
    th { background:#eef2f7; font-size:10px; text-transform:uppercase; }
    td.r, th.r { text-align:right; }
    td.c, th.c { text-align:center; }
    .ringkas { border:1px solid #bbb; background:#fafafa; padding:7px 9px; margin:6px 0 10px; line-height:1.45; }
    .ttd { display:flex; gap:20px; margin-top:22px; }
    .ttd > div { flex:1; text-align:center; font-size:10.5px; }
    .ttd .garis { margin-top:46px; border-top:1px solid #333; padding-top:3px; }
    .ttd .nama-orang { font-weight:700; }
    .kartu { border:1px solid #666; padding:8px 10px; margin-bottom:7mm; page-break-inside:avoid; }
    .kartu .kepala { display:flex; justify-content:space-between; align-items:baseline; border-bottom:1px solid #999; padding-bottom:5px; margin-bottom:6px; }
    .kartu .kepala b { font-size:12px; }
    .identitas { display:flex; flex-wrap:wrap; gap:2px 14px; margin-bottom:6px; }
    .identitas div { font-size:10.5px; }
    .identitas i { color:#666; font-style:normal; }
    .kecil { font-size:9.5px; color:#555; }
    .ambang-predikat { margin:-6px 0 6px; }
    .pagebreak { page-break-before: always; }
  `
}

/* ------------------------------- Kepala ----------------------------------- */

function kopLaporan(d: DataLaporan, judul: string, sub: string): string {
  const logo = d.logo ? `<img src="${esc(d.logo)}" alt="logo" />` : ''
  return `
    <div class="kop">
      ${logo}
      <div>
        <div class="nama">${esc(d.namaTim || 'Marching Band')}</div>
        <div class="sub">${esc(judul)} · ${esc(sub)}</div>
      </div>
    </div>`
}

/** Tanggal hari ini saja, mis. "17 September 2026". */
function hariIni(): string {
  const n = new Date()
  return `${n.getDate()} ${BULAN[n.getMonth()]} ${n.getFullYear()}`
}

/** Baris "Yogyakarta, 17 September 2026" — tanpa koma menggantung kalau kota belum diisi. */
function tanggalCetak(kota?: string): string {
  return kota ? `${esc(kota)}, ${hariIni()}` : hariIni()
}

/* ---------------------------- Laporan bulanan ------------------------------ */

/** Isi laporan bulanan (tanpa <html> — dibungkus `printShell` oleh pemanggil). */
export function bodyLaporan(d: DataLaporan): string {
  const baris = susunBaris(d)
  const r = susunRingkasan(d, baris)
  const kota = d.kota?.trim() ?? ''

  const tiles = [
    ['Kehadiran', `${r.rate}%`],
    ['Sesi', String(r.sesi)],
    ['Anggota', String(r.anggota)],
    ['Hadir', String(r.counts.hadir)],
    ['Izin', String(r.counts.izin)],
    ['Sakit', String(r.counts.sakit)],
    ['Tanpa keterangan', String(r.counts.alpha)],
  ]
    .map(([label, nilai]) => `<div class="tile"><span>${esc(label)}</span><b>${esc(nilai)}</b></div>`)
    .join('')

  const tabelSection = r.perSection.length
    ? `<h2>Rekap per section</h2>
      <table>
        <thead><tr><th>Section</th><th class="r">Anggota</th><th class="r">Hadir</th><th class="r">Izin</th><th class="r">Sakit</th><th class="r">Tanpa keterangan</th><th class="r">% Hadir</th></tr></thead>
        <tbody>
          ${r.perSection
            .map(
              (x) => `<tr><td>${esc(x.label)}</td><td class="r">${x.anggota}</td><td class="r">${x.counts.hadir}</td>
              <td class="r">${x.counts.izin}</td><td class="r">${x.counts.sakit}</td><td class="r">${x.counts.alpha}</td>
              <td class="r">${x.rate}%</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>`
    : ''

  const tabelJenis = r.perJenis.length
    ? `<h2>Kehadiran per jenis kegiatan</h2>
      <table>
        <thead><tr><th>Jenis kegiatan</th><th class="r">Sesi</th><th class="r">Hadir</th><th class="r">Terisi</th><th class="r">% Hadir</th></tr></thead>
        <tbody>
          ${r.perJenis
            .map((x) => `<tr><td>${esc(x.label)}</td><td class="r">${x.sesi}</td><td class="r">${x.h}</td><td class="r">${x.f}</td><td class="r">${x.rate}%</td></tr>`)
            .join('')}
        </tbody>
      </table>`
    : ''

  const tabelSesi = `<h2>Rincian per sesi</h2>
      <table>
        <thead><tr><th>Tanggal</th><th>Kegiatan</th><th>Jenis</th><th class="r">Hadir</th><th class="r">Izin</th><th class="r">Sakit</th><th class="r">Tanpa keterangan</th><th class="r">% Hadir</th></tr></thead>
        <tbody>
          ${[...d.sesi]
            .sort((a, b) => a.date.localeCompare(b.date))
            .map((s) => {
              const rows = d.catatan.filter((c) => c.sessionId === s.id)
              const c: Record<AttendanceStatus, number> = { hadir: 0, izin: 0, sakit: 0, alpha: 0 }
              for (const x of rows) c[x.status]++
              const f = URUT_STATUS.reduce((a, k) => a + c[k], 0)
              return `<tr><td>${esc(formatDateShort(s.date))}</td><td>${esc(s.title)}</td><td>${esc(sesiMeta(s.type).label)}</td>
                <td class="r">${c.hadir}</td><td class="r">${c.izin}</td><td class="r">${c.sakit}</td><td class="r">${c.alpha}</td>
                <td class="r">${pct(c.hadir, f)}%</td></tr>`
            })
            .join('')}
        </tbody>
      </table>`

  const tabelAnggota = `<h2>Rekap per anggota</h2>
      <table>
        <thead><tr><th>Kode</th><th>Nama</th><th>Section</th><th class="r">Hadir</th><th class="r">Izin</th><th class="r">Sakit</th><th class="r">Tanpa keterangan</th><th class="r">Sesi</th><th class="r">% Hadir</th></tr></thead>
        <tbody>
          ${[...baris]
            .sort((a, b) => b.rate - a.rate || a.member.name.localeCompare(b.member.name))
            .map(
              (b) => `<tr><td>${esc(b.member.code)}</td><td>${esc(b.member.name)}</td><td>${esc(sectionLabel(b.member.section))}</td>
              <td class="r">${b.counts.hadir}</td><td class="r">${b.counts.izin}</td><td class="r">${b.counts.sakit}</td>
              <td class="r">${b.counts.alpha}</td><td class="r">${b.terisi}</td><td class="r">${b.rate}%</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>`

  const blokPerhatian = r.perhatian.length
    ? `<h2>Perlu perhatian (di bawah ${d.batas}%)</h2>
      <table>
        <thead><tr><th>Kode</th><th>Nama</th><th>Section</th><th class="r">% Hadir</th><th>Hadir / sesi</th></tr></thead>
        <tbody>
          ${r.perhatian
            .map(
              (b) => `<tr><td>${esc(b.member.code)}</td><td>${esc(b.member.name)}</td><td>${esc(sectionLabel(b.member.section))}</td>
              <td class="r">${b.rate}%</td><td>${b.counts.hadir} dari ${b.terisi}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>`
    : ''

  return `
    ${kopLaporan(d, 'Laporan Kehadiran', d.periode)}
    <h1 class="judul">Laporan Kehadiran</h1>
    <p class="sub">Periode ${esc(d.periode)} · dicetak ${tanggalCetak(d.kota)}</p>

    <div class="tiles">${tiles}</div>
    <div class="ringkas">${esc(r.kalimat)}</div>
    ${tabelSection}
    ${tabelJenis}
    ${tabelSesi}
    ${blokPerhatian}
    ${tabelAnggota}

    <div class="ttd">
      <div>Mengetahui,<br/><span class="kecil">Pembina / Ketua Tim</span>
        <div class="garis">( ........................................ )</div>
      </div>
      <div>${esc(kota ? kota + ', ' : '')}${hariIni()}<br/><span class="kecil">Pelatih</span>
        <div class="garis"><span class="nama-orang">${esc(d.pelatih || '........................................')}</span></div>
      </div>
    </div>`
}

/** Laporan bulanan lengkap siap cetak / unduh. */
export function htmlLaporan(d: DataLaporan): string {
  return printShell(`Laporan Kehadiran ${d.periode}`, bodyLaporan(d), cssCetak())
}

/* --------------------------- Kartu kehadiran -------------------------------- */

/** Satu kartu kehadiran untuk satu anggota. */
function satuKartu(d: DataLaporan, b: BarisAnggota): string {
  const urut = [...d.sesi].sort((x, y) => x.date.localeCompare(y.date))
  const labelPeran = ROLE_LABEL[b.member.role] ?? b.member.role
  const kota = d.kota?.trim() ?? ''

  const rincian = urut.length
    ? `<table>
        <thead><tr><th>Tanggal</th><th>Kegiatan</th><th>Jenis</th><th class="c">Status</th><th>Keterangan</th></tr></thead>
        <tbody>
          ${urut
            .map((s) => {
              const st = b.status.get(s.id)
              const ket = d.catatan.find((c) => c.sessionId === s.id && c.memberId === b.member.id)?.note
              return `<tr><td>${esc(formatDateShort(s.date))}</td><td>${esc(s.title)}</td><td>${esc(sesiMeta(s.type).singkat)}</td>
                <td class="c" style="color:${st ? WARNA_STATUS[st] : '#999'}">
                  <b>${st ? SINGKAT_STATUS[st] : '–'}</b>${st ? ` <span class="kecil">${LABEL_STATUS[st]}</span>` : ''}
                </td>
                <td>${esc(ket?.trim() ?? '')}</td></tr>`
            })
            .join('')}
        </tbody>
      </table>`
    : `<p class="kecil">Belum ada sesi pada periode ini.</p>`

  const predikat = predikatKehadiran(b, d.predikat)

  return `
    <div class="kartu">
      <div class="kepala">
        <b>Kartu Kehadiran</b>
        <span class="kecil">${esc(d.namaTim || 'Marching Band')} · ${esc(d.periode)}</span>
      </div>
      <div class="identitas">
        <div><i>Nama</i> &nbsp;<b>${esc(b.member.name)}</b></div>
        <div><i>Kode</i> &nbsp;${esc(b.member.code)}</div>
        <div><i>Section</i> &nbsp;${esc(sectionLabel(b.member.section))}</div>
        <div><i>Instrumen</i> &nbsp;${esc(b.member.instrument || '-')}</div>
        <div><i>Peran</i> &nbsp;${esc(labelPeran)}</div>
        <div><i>Gabung</i> &nbsp;${b.member.joinYear || '-'}</div>
      </div>
      <table>
        <thead><tr><th>Hadir</th><th>Izin</th><th>Sakit</th><th>Tanpa keterangan</th><th>Sesi tercatat</th><th>% Kehadiran</th><th>Predikat</th></tr></thead>
        <tbody>
          <tr>
            <td>${b.counts.hadir}</td><td>${b.counts.izin}</td><td>${b.counts.sakit}</td><td>${b.counts.alpha}</td>
            <td>${b.terisi}</td><td><b>${b.rate}%</b></td><td>${esc(predikat)}</td>
          </tr>
        </tbody>
      </table>
      <p class="kecil ambang-predikat">Predikat: ${esc(teksAmbangPredikat(d.predikat))}</p>
      ${rincian}
      ${b.keterangan.length ? `<p class="kecil"><b>Catatan pelatih:</b> ${b.keterangan.map((k) => esc(`${formatDateShort(k.tanggal)} — ${k.teks}`)).join('; ')}</p>` : ''}
      <div class="ttd">
        <div><span class="kecil">Paraf anggota</span><div class="garis">( ........................ )</div></div>
        <div><span class="kecil">${esc(kota ? kota + ', ' : '')}${hariIni()}<br/>Pelatih</span>
          <div class="garis"><span class="nama-orang">${esc(d.pelatih || '........................')}</span></div>
        </div>
      </div>
    </div>`
}

/**
 * Kartu kehadiran. Tanpa `hanyaId` → semua anggota; kalau diisi, hanya anggota
 * tersebut (dipakai tombol "kartu saya" di baris tabel).
 */
export function bodyKartu(d: DataLaporan, hanyaId?: string): string {
  const baris = susunBaris(d)
    .filter((b) => (hanyaId ? b.member.id === hanyaId : true))
    .sort((a, b) => a.member.name.localeCompare(b.member.name))
  if (!baris.length) return '<p>Belum ada anggota pada periode ini.</p>'
  return `
    ${kopLaporan(d, 'Kartu Kehadiran Anggota', d.periode)}
    <h1 class="judul">Kartu Kehadiran Anggota</h1>
    <p class="sub">Periode ${esc(d.periode)} · ${baris.length} kartu · dicetak ${tanggalCetak(d.kota)}</p>
    ${baris.map((b) => satuKartu(d, b)).join('')}`
}

/** Kartu kehadiran lengkap siap cetak / unduh. */
export function htmlKartu(d: DataLaporan, hanyaId?: string): string {
  return printShell(`Kartu Kehadiran ${d.periode}`, bodyKartu(d, hanyaId), cssCetak())
}

/** Paket lengkap: laporan + semua kartu dalam satu berkas (praktis dibawa ke HP). */
export function htmlPaket(d: DataLaporan): string {
  const body = `${bodyLaporan(d)}<div class="pagebreak"></div>${bodyKartu(d)}`
  return printShell(`Paket Laporan ${d.periode}`, body, cssCetak())
}

/* ---------------------------------- CSV ------------------------------------ */

/**
 * CSV matriks: satu baris per anggota, satu kolom per sesi.
 * Bentuk ini paling enak dibuka di Excel (termasuk Excel HP) karena tinggal
 * dibaca menyamping — status tiap sesi langsung kelihatan.
 */
export function csvMatriks(d: DataLaporan): string {
  const baris = susunBaris(d)
  const urut = [...d.sesi].sort((a, b) => a.date.localeCompare(b.date))
  const judulSesi = urut.map((s) => `${formatDateShort(s.date)} · ${sesiMeta(s.type).singkat}`)

  const rows: unknown[][] = [
    ['Kode', 'Nama', 'Section', ...judulSesi, 'Hadir', 'Izin', 'Sakit', 'Tanpa keterangan', 'Total sesi', '% Kehadiran'],
    ...[...baris]
      .sort((a, b) => a.member.name.localeCompare(b.member.name))
      .map((b) => [
        b.member.code,
        b.member.name,
        sectionLabel(b.member.section),
        ...urut.map((s) => (b.status.has(s.id) ? SINGKAT_STATUS[b.status.get(s.id)!] : '')),
        b.counts.hadir,
        b.counts.izin,
        b.counts.sakit,
        b.counts.alpha,
        b.terisi,
        `${b.rate}%`,
      ]),
  ]
  return toCSV(rows)
}

/**
 * CSV ringkas: satu tabel bersih (tanpa blok bertumpuk seperti ekspor lama),
 * jadi langsung rapi saat dibuka di Excel atau aplikasi spreadsheet HP.
 */
export function csvRingkas(d: DataLaporan): string {
  const baris = susunBaris(d)
  const rows: unknown[][] = [
    ['Kode', 'Nama', 'Section', 'Instrumen', 'Peran', 'Hadir', 'Izin', 'Sakit', 'Tanpa keterangan', 'Total sesi', '% Kehadiran', 'Predikat'],
    ...[...baris]
      .sort((a, b) => a.member.name.localeCompare(b.member.name))
      .map((b) => [
        b.member.code,
        b.member.name,
        sectionLabel(b.member.section),
        b.member.instrument || '',
        ROLE_LABEL[b.member.role] ?? b.member.role,
        b.counts.hadir,
        b.counts.izin,
        b.counts.sakit,
        b.counts.alpha,
        b.terisi,
        `${b.rate}%`,
        predikatKehadiran(b, d.predikat),
      ]),
  ]
  return toCSV(rows)
}

/* -------------------------------- Aksi ------------------------------------- */

/**
 * Nama berkas seragam: `laporan-kehadiran-2026-09.html`.
 * Jenisnya ikut jadi awalan nama, jadi CSV matriks dan CSV ringkas tidak
 * saling menimpa saat keduanya diunduh di periode yang sama.
 */
export function namaBerkas(
  jenis: 'laporan' | 'kartu' | 'paket' | 'matriks' | 'ringkas',
  kunci: string,
  ekstensi: string,
): string {
  return `${jenis}-kehadiran-${kunci || 'semua'}.${ekstensi}`
}

/**
 * Cetak ke jendela baru; kalau browser memblokir popup (mis. di dalam iframe
 * pratinjau), simpan sebagai berkas HTML agar pengguna tetap bisa Ctrl+P.
 * Mengembalikan `true` kalau dialog cetak berhasil dibuka.
 */
export function cetakAtauUnduh(html: string, namaFile: string): boolean {
  if (printHtml(html)) return true
  downloadHtmlFile(html, namaFile)
  return false
}

/** Unduh string CSV. */
export function unduhCsv(isi: string, namaFile: string) {
  downloadFile(namaFile, isi, 'text/csv')
}
