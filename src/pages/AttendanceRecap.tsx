import { useMemo, useState } from 'react'
import type { AttendanceRecord, AttendanceStatus, Member, Session } from '../db/types'
import { Badge, Button, Card, EmptyState, Select, StatTile, useToast } from '../components/ui'
import { IconDownload, IconPrinter } from '../components/Icons'
import {
  STATUS_META,
  cx,
  downloadFile,
  formatDateShort,
  pct,
  sectionLabel,
  sesiMeta,
  toCSV,
  URUTAN_JENIS,
  visibleSections,
} from '../lib/utils'
import { downloadHtmlFile, esc, printHtml, printShell } from '../lib/print'
import { useSettings } from '../hooks/useSettings'
import AdminReports from '../components/AdminReports'
import type { DataLaporan } from '../lib/laporan'
import { rapikanPredikat } from '../lib/laporan'

const ORDER: AttendanceStatus[] = ['hadir', 'izin', 'sakit', 'alpha']
const BAR: Record<AttendanceStatus, string> = {
  hadir: '#10b981',
  izin: '#38bdf8',
  sakit: '#f59e0b',
  alpha: '#f43f5e',
}

const BULAN = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember',
]

/**
 * Rekap kehadiran: grafik per sesi, rekap per anggota, rekap per section,
 * plus ekspor CSV dan cetak/unduh HTML.
 */
export default function AttendanceRecap({
  members,
  sessions,
  records,
}: {
  members: Member[]
  sessions: Session[]
  records: AttendanceRecord[]
}) {
  const toast = useToast()
  /** Identitas tim untuk kepala laporan (D4). */
  const settings = useSettings()
  const [month, setMonth] = useState<string>('all')
  const [section, setSection] = useState<string>('all')
  /** D3 — saring rekap menurut jenis kegiatan (latihan section / gabungan / konser…). */
  const [jenis, setJenis] = useState<string>('all')
  const [sort, setSort] = useState<'pct' | 'name' | 'perhatian'>('pct')
  /**
   * Ambang kehadiran rendah (%) — dipakai penanda "perlu perhatian" (D2),
   * daftar "Perlu perhatian" di laporan, dan CSV.
   *
   * J1a — bawaannya **mengikuti ambang predikat Cukup** dari Pengaturan.
   * Dulu bawaannya 60 dan tidak terhubung ke apa pun, sehingga anggota 65%
   * berpredikat "Perlu perhatian" di kartu kehadirannya tetapi tidak masuk
   * daftar "Perlu perhatian (di bawah 60%)" di laporan yang sama.
   *
   * `null` = ikut Cukup. Memilih angka lain di tab Rekap tetap boleh (untuk
   * melihat sekilas), tetapi hanya untuk kunjungan ini dan diberi tanda
   * bahwa kartu kehadiran tetap memakai ambang Cukup.
   */
  const [batasManual, setBatasManual] = useState<number | null>(null)
  const batasCukup = rapikanPredikat(settings.ambangPredikat).cukup
  const batas = batasManual ?? batasCukup
  const pilihanBatas = [...new Set([50, 60, 70, 80, batasCukup])].sort((a, b) => a - b)
  /** Hanya tampilkan anggota yang perlu perhatian di tabel. */
  const [hanyaPerhatian, setHanyaPerhatian] = useState(false)

  const months = useMemo(() => {
    const set = new Set(sessions.map((s) => s.date.slice(0, 7)))
    return [...set].sort((a, b) => b.localeCompare(a))
  }, [sessions])

  /** D3 — sesi yang lolos penyaring jenis kegiatan (tanpa penyaring bulan). */
  const sesiJenis = useMemo(
    () => sessions.filter((s) => (jenis === 'all' ? true : s.type === jenis)),
    [sessions, jenis],
  )

  const filteredSessions = useMemo(
    () =>
      sessions
        .filter((s) => (month === 'all' ? true : s.date.startsWith(month)))
        .filter((s) => (jenis === 'all' ? true : s.type === jenis))
        .sort((a, b) => a.date.localeCompare(b.date)),
    [sessions, month, jenis],
  )

  /** D3 — jumlah sesi per jenis, untuk label pilihan penyaring. */
  const hitungJenis = useMemo(() => {
    const m = new Map<string, number>()
    for (const s of sessions) m.set(s.type, (m.get(s.type) ?? 0) + 1)
    return m
  }, [sessions])

  const filteredMembers = useMemo(
    () => members.filter((m) => (section === 'all' ? true : m.section === section)),
    [members, section],
  )

  const sessionIds = useMemo(() => new Set(filteredSessions.map((s) => s.id)), [filteredSessions])
  const memberIds = useMemo(() => new Set(filteredMembers.map((m) => m.id)), [filteredMembers])

  /**
   * TREN (D2): kehadiran per bulan, dihitung dari semua sesi.
   * Filter **section** dan **jenis** tetap dihormati (jadi bisa melihat tren
   * per section atau tren khusus konser), sedangkan filter bulan tidak — karena
   * justru itulah yang ingin dilihat. (D3)
   */
  const perMonth = useMemo(() => {
    const byMonth = new Map<string, Session[]>()
    for (const s of sesiJenis) {
      const k = s.date.slice(0, 7)
      const list = byMonth.get(k)
      if (list) list.push(s)
      else byMonth.set(k, [s])
    }
    return [...byMonth.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, list]) => {
        const ids = new Set(list.map((s) => s.id))
        let hadir = 0
        let filled = 0
        for (const r of records) {
          if (!ids.has(r.sessionId) || !memberIds.has(r.memberId)) continue
          filled++
          if (r.status === 'hadir') hadir++
        }
        return {
          key,
          label: `${BULAN[Number(key.slice(5, 7)) - 1].slice(0, 3)} ${key.slice(2, 4)}`,
          panjang: `${BULAN[Number(key.slice(5, 7)) - 1]} ${key.slice(0, 4)}`,
          sesi: list.length,
          rate: pct(hadir, filled),
          hadir,
          filled,
        }
      })
  }, [sesiJenis, records, memberIds])

  /** Bulan yang sedang disorot: bulan yang dipilih, atau bulan terakhir berisi data. */
  const bulanAktif = month !== 'all' ? month : (perMonth[perMonth.length - 1]?.key ?? '')
  /** Bulan pembandingnya (bulan sebelumnya, kalau ada). */
  const bulanBanding = useMemo(() => {
    const i = perMonth.findIndex((m) => m.key === bulanAktif)
    return i > 0 ? perMonth[i - 1].key : ''
  }, [perMonth, bulanAktif])

  /** Peta bulan → anggota → {hadir, terisi}. Dipakai untuk tren per anggota. */
  const mapBulan = useMemo(() => {
    const out = new Map<string, Map<string, { h: number; f: number }>>()
    const bulanSesi = new Map(sesiJenis.map((s) => [s.id, s.date.slice(0, 7)]))
    for (const r of records) {
      if (!memberIds.has(r.memberId)) continue
      const key = bulanSesi.get(r.sessionId)
      if (!key) continue
      let perAnggota = out.get(key)
      if (!perAnggota) {
        perAnggota = new Map()
        out.set(key, perAnggota)
      }
      const e = perAnggota.get(r.memberId) ?? { h: 0, f: 0 }
      e.f++
      if (r.status === 'hadir') e.h++
      perAnggota.set(r.memberId, e)
    }
    return out
  }, [records, sesiJenis, memberIds])

  /** Persentase kehadiran seorang anggota pada bulan tertentu (null = tidak ada data). */
  const rateBulan = (memberId: string, key: string) => {
    if (!key) return null
    const e = mapBulan.get(key)?.get(memberId)
    return e ? pct(e.h, e.f) : null
  }

  const recs = useMemo(
    () => records.filter((r) => sessionIds.has(r.sessionId) && memberIds.has(r.memberId)),
    [records, sessionIds, memberIds],
  )

  /* --------------------------- Perhitungan -------------------------------- */

  // Ringkasan per sesi (untuk grafik batang bertumpuk)
  const perSession = filteredSessions.map((s) => {
    const rows = recs.filter((r) => r.sessionId === s.id)
    const counts: Record<AttendanceStatus, number> = { hadir: 0, izin: 0, sakit: 0, alpha: 0 }
    for (const r of rows) counts[r.status]++
    const filled = ORDER.reduce((a, k) => a + counts[k], 0)
    return { session: s, counts, total: filled, rate: pct(counts.hadir, filled) }
  })

  // Rekap per anggota + tren (D2): bandingkan bulan yang disorot dengan bulan sebelumnya.
  const semuaAnggota = filteredMembers.map((m) => {
    const rows = recs.filter((r) => r.memberId === m.id)
    const counts: Record<AttendanceStatus, number> = { hadir: 0, izin: 0, sakit: 0, alpha: 0 }
    for (const r of rows) counts[r.status]++
    const filled = ORDER.reduce((a, k) => a + counts[k], 0)
    const rateAktif = rateBulan(m.id, bulanAktif)
    const rateBanding = rateBulan(m.id, bulanBanding)
    return {
      member: m,
      counts,
      filled,
      rate: pct(counts.hadir, filled),
      /** Selisih poin: bulan yang disorot dikurangi bulan sebelumnya (null = data kurang). */
      tren: rateAktif !== null && rateBanding !== null ? rateAktif - rateBanding : null,
    }
  })

  /** Anggota dengan kehadiran rendah, dan anggota yang kehadirannya menurun tajam. */
  const rendah = semuaAnggota.filter((x) => x.filled > 0 && x.rate < batas)
  const menurun = semuaAnggota.filter((x) => x.tren !== null && x.tren <= -10)
  const perhatianIds = new Set([...rendah, ...menurun].map((x) => x.member.id))

  const perMember = semuaAnggota
    .filter((x) => (hanyaPerhatian ? perhatianIds.has(x.member.id) : true))
    .sort((a, b) => {
      if (sort === 'name') return a.member.name.localeCompare(b.member.name)
      if (sort === 'perhatian') return (a.tren ?? 0) - (b.tren ?? 0) || a.rate - b.rate
      return b.rate - a.rate
    })

  /* ------------------------------ Tren (D2) -------------------------------- */

  /** Rata-rata kehadiran 6 bulan terakhir. */
  const rataTren = useMemo(() => {
    const ambil = perMonth.slice(-6)
    if (!ambil.length) return 0
    return Math.round(ambil.reduce((a, m) => a + m.rate, 0) / ambil.length)
  }, [perMonth])

  /** Perbandingan dua bulan terakhir: naik / turun / stabil. */
  const banding = useMemo(() => {
    if (perMonth.length < 2) return null
    const terakhir = perMonth[perMonth.length - 1]
    const sebelum = perMonth[perMonth.length - 2]
    const delta = terakhir.rate - sebelum.rate
    return {
      terakhir,
      sebelum,
      delta,
      arah: delta >= 3 ? 'naik' : delta <= -3 ? 'turun' : 'stabil',
    }
  }, [perMonth])

  // Rekap per section
  const perSection = visibleSections()
    .map((sec) => {
      const rows = perMember.filter((x) => x.member.section === sec.id)
      const counts: Record<AttendanceStatus, number> = { hadir: 0, izin: 0, sakit: 0, alpha: 0 }
      for (const r of rows) for (const k of ORDER) counts[k] += r.counts[k]
      const filled = ORDER.reduce((a, k) => a + counts[k], 0)
      return { sec, counts, filled, anggota: rows.length, rate: pct(counts.hadir, filled) }
    })
    .filter((x) => x.anggota > 0)

  /**
   * D3 — Rekap per jenis kegiatan. Dihitung dari catatan yang sudah lolos
   * penyaring periode, section, dan jenis — jadi angka latihan section,
   * latihan gabungan, dan penampilan bisa dibandingkan langsung.
   */
  const jenisSesi = useMemo(() => new Map(sessions.map((s) => [s.id, s.type])), [sessions])

  const perJenis = useMemo(() => {
    const akum = new Map<string, { sesi: Set<string>; h: number; f: number }>()
    for (const r of recs) {
      const t = jenisSesi.get(r.sessionId) ?? 'lainnya'
      let e = akum.get(t)
      if (!e) {
        e = { sesi: new Set(), h: 0, f: 0 }
        akum.set(t, e)
      }
      e.sesi.add(r.sessionId)
      e.f++
      if (r.status === 'hadir') e.h++
    }
    const rows = URUTAN_JENIS.map((t) => {
      const e = akum.get(t)
      if (!e) return null
      return { jenis: t, label: sesiMeta(t).label, color: sesiMeta(t).color, sesi: e.sesi.size, h: e.h, f: e.f, rate: pct(e.h, e.f) }
    })
    return rows.filter((x): x is NonNullable<typeof x> => x !== null)
  }, [recs, jenisSesi])

  const totals: Record<AttendanceStatus, number> = { hadir: 0, izin: 0, sakit: 0, alpha: 0 }
  for (const r of recs) totals[r.status]++
  const totalFilled = ORDER.reduce((a, k) => a + totals[k], 0)
  const overallRate = pct(totals.hadir, totalFilled)

  /**
   * D4 — Data untuk paket laporan admin. Disusun dari penyaring yang sedang
   * aktif, jadi isi laporan selalu sama dengan yang tampil di layar.
   */
  const dataLaporan = useMemo<DataLaporan>(
    () => ({
      namaTim: settings.teamName,
      pelatih: settings.coachName,
      kota: settings.city,
      logo: settings.logo,
      periode: month === 'all' ? 'Semua periode' : `${BULAN[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`,
      kunci: month === 'all' ? 'semua' : month,
      anggota: filteredMembers,
      sesi: filteredSessions,
      catatan: recs,
      batas,
      banding: banding ? { label: banding.sebelum.panjang, rate: banding.sebelum.rate } : null,
      // J1 — ambang predikat milik tim (Pengaturan). Kosong → bawaan 85/70.
      predikat: settings.ambangPredikat,
    }),
    [settings, month, filteredMembers, filteredSessions, recs, batas, banding],
  )

  /* ------------------------------ Ekspor ---------------------------------- */

  function exportCSV() {
    const rows: unknown[][] = [
      [
        'Periode', month === 'all' ? 'Semua' : month,
        'Section', section === 'all' ? 'Semua' : sectionLabel(section),
        'Jenis', jenis === 'all' ? 'Semua' : sesiMeta(jenis).label,
      ],
      [],
      ['Kode', 'Nama', 'Section', 'Hadir', 'Izin', 'Sakit', 'Tanpa keterangan', 'Total sesi', '% Kehadiran'],
      ...perMember.map((x) => [
        x.member.code,
        x.member.name,
        sectionLabel(x.member.section),
        x.counts.hadir,
        x.counts.izin,
        x.counts.sakit,
        x.counts.alpha,
        x.filled,
        `${x.rate}%`,
      ]),
      [],
      [],
      ['Kehadiran per jenis kegiatan'],
      ['Jenis', 'Sesi', 'Hadir', 'Terisi', '% Kehadiran'],
      ...perJenis.map((x) => [x.label, x.sesi, x.h, x.f, `${x.rate}%`]),
      [],
      [],
      ['Tren per bulan'],
      ['Bulan', 'Sesi', 'Hadir', 'Terisi', '% Kehadiran'],
      ...perMonth.map((m) => [m.key, m.sesi, m.hadir, m.filled, `${m.rate}%`]),
      [],
      ['Perlu perhatian (ambang < ' + batas + '%)'],
      ['Kode', 'Nama', 'Section', '% Kehadiran', 'Tren (poin)', 'Alasan'],
      ...[...rendah.map((x) => [x.member.code, x.member.name, sectionLabel(x.member.section), `${x.rate}%`, x.tren ?? '', 'Kehadiran rendah']),
          ...menurun.map((x) => [x.member.code, x.member.name, sectionLabel(x.member.section), `${x.rate}%`, x.tren ?? '', 'Mulai menurun'])],
      ['Ringkasan per sesi'],
      ['Tanggal', 'Sesi', 'Hadir', 'Izin', 'Sakit', 'Tanpa keterangan', '% Kehadiran'],
      ...perSession.map((x) => [
        x.session.date,
        x.session.title,
        x.counts.hadir,
        x.counts.izin,
        x.counts.sakit,
        x.counts.alpha,
        `${x.rate}%`,
      ]),
    ]
    downloadFile(`rekap-absensi-${month === 'all' ? 'semua' : month}.csv`, toCSV(rows), 'text/csv')
    toast.push('Rekap CSV diunduh')
  }

  function buildHtml(): string {
    const periode = month === 'all' ? 'Semua periode' : `${BULAN[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`
    const body = `
      <h1>Rekap Kehadiran</h1>
      <p class="sub">${esc(periode)} · ${filteredSessions.length} sesi · ${filteredMembers.length} anggota · rata-rata kehadiran ${overallRate}%</p>

      <h2>Ringkasan</h2>
      <table>
        <tr><th>Hadir</th><th>Izin</th><th>Sakit</th><th>Tanpa keterangan</th><th>Total catatan</th></tr>
        <tr><td>${totals.hadir}</td><td>${totals.izin}</td><td>${totals.sakit}</td><td>${totals.alpha}</td><td>${totalFilled}</td></tr>
      </table>

      <h2>Tren per bulan</h2>
      <table>
        <thead><tr><th>Bulan</th><th>Sesi</th><th>Hadir</th><th>Terisi</th><th>% Kehadiran</th></tr></thead>
        <tbody>
          ${perMonth
            .map(
              (m) => `<tr><td>${esc(m.panjang)}</td><td>${m.sesi}</td><td>${m.hadir}</td><td>${m.filled}</td><td>${m.rate}%</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>

      ${
        perhatianIds.size
          ? `<h2>Perlu perhatian (ambang &lt; ${batas}%)</h2>
      <table>
        <thead><tr><th>Kode</th><th>Nama</th><th>% Kehadiran</th><th>Tren</th><th>Alasan</th></tr></thead>
        <tbody>
          ${[...rendah, ...menurun]
            .map(
              (x) => `<tr><td>${esc(x.member.code)}</td><td>${esc(x.member.name)}</td><td>${x.rate}%</td>
              <td>${x.tren === null ? '-' : (x.tren > 0 ? '+' : '') + x.tren}</td>
              <td>${x.rate < batas ? 'Kehadiran rendah' : 'Mulai menurun'}</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>`
          : ''
      }

      <h2>Per sesi</h2>
      <table>
        <thead><tr><th>Tanggal</th><th>Sesi</th><th>H</th><th>I</th><th>S</th><th>A</th><th>% Hadir</th></tr></thead>
        <tbody>
          ${perSession
            .map(
              (x) => `<tr><td>${x.session.date}</td><td>${esc(x.session.title)}</td>
              <td>${x.counts.hadir}</td><td>${x.counts.izin}</td><td>${x.counts.sakit}</td><td>${x.counts.alpha}</td>
              <td>${x.rate}%</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>

      <h2>Per anggota</h2>
      <table>
        <thead><tr><th>Kode</th><th>Nama</th><th>Section</th><th>H</th><th>I</th><th>S</th><th>A</th><th>% Hadir</th></tr></thead>
        <tbody>
          ${perMember
            .map(
              (x) => `<tr><td>${esc(x.member.code)}</td><td>${esc(x.member.name)}</td><td>${esc(sectionLabel(x.member.section))}</td>
              <td>${x.counts.hadir}</td><td>${x.counts.izin}</td><td>${x.counts.sakit}</td><td>${x.counts.alpha}</td>
              <td>${x.rate}%</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>

      <h2>Per jenis kegiatan</h2>
      <table>
        <thead><tr><th>Jenis</th><th>Sesi</th><th>Hadir</th><th>Terisi</th><th>% Hadir</th></tr></thead>
        <tbody>
          ${perJenis
            .map(
              (x) => `<tr><td>${esc(x.label)}</td><td>${x.sesi}</td>
              <td>${x.h}</td><td>${x.f}</td>
              <td>${x.rate}%</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>

      <h2>Per section</h2>
      <table>
        <thead><tr><th>Section</th><th>Anggota</th><th>H</th><th>I</th><th>S</th><th>A</th><th>% Hadir</th></tr></thead>
        <tbody>
          ${perSection
            .map(
              (x) => `<tr><td>${esc(x.sec.label)}</td><td>${x.anggota}</td>
              <td>${x.counts.hadir}</td><td>${x.counts.izin}</td><td>${x.counts.sakit}</td><td>${x.counts.alpha}</td>
              <td>${x.rate}%</td></tr>`,
            )
            .join('')}
        </tbody>
      </table>`

    return printShell(
      `Rekap Absensi ${periode}`,
      body,
      `@page { size: A4 portrait; margin: 14mm; }
       body { font-size: 11px; }
       h1 { font-size: 16px; margin: 0 0 2px; }
       h2 { font-size: 12px; margin: 14px 0 6px; }
       .sub { font-size: 10.5px; color:#555; margin: 0 0 6px; }
       table { width:100%; border-collapse: collapse; margin-bottom: 4px; }
       th, td { border: 1px solid #999; padding: 3px 5px; text-align: left; }
       th { background:#f0f0f0; font-size: 10px; text-transform: uppercase; }`,
    )
  }

  function doPrint() {
    const html = buildHtml()
    if (!printHtml(html)) {
      downloadHtmlFile(html, `rekap-absensi-${month === 'all' ? 'semua' : month}.html`)
      toast.push('Jendela cetak diblokir — berkas HTML diunduh. Buka lalu Ctrl+P.', 'info')
    }
  }

  /* ------------------------------- Render ---------------------------------- */

  return (
    <div className="space-y-4">
      {/* Filter */}
      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[160px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-400">Periode</label>
            <Select data-kiosk-allow value={month} onChange={(e) => setMonth(e.target.value)}>
              <option value="all">Semua periode</option>
              {months.map((m) => (
                <option key={m} value={m}>
                  {BULAN[Number(m.slice(5, 7)) - 1]} {m.slice(0, 4)}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[150px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-400">Jenis kegiatan</label>
            <Select
              data-testid="saring-jenis-rekap"
              data-kiosk-allow
              value={jenis}
              onChange={(e) => setJenis(e.target.value)}
            >
              <option value="all">Semua jenis</option>
              {URUTAN_JENIS.map((t) =>
                hitungJenis.get(t) ? (
                  <option key={t} value={t}>
                    {sesiMeta(t).label} ({hitungJenis.get(t)})
                  </option>
                ) : null,
              )}
            </Select>
          </div>
          <div className="min-w-[150px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-400">Section</label>
            <Select data-kiosk-allow value={section} onChange={(e) => setSection(e.target.value)}>
              <option value="all">Semua section</option>
              {visibleSections().map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[150px] flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-400">Urutkan</label>
            <Select data-kiosk-allow value={sort} onChange={(e) => setSort(e.target.value as 'pct' | 'name' | 'perhatian')}>
              <option value="pct">Kehadiran tertinggi</option>
              <option value="name">Nama A–Z</option>
              <option value="perhatian">Perlu perhatian dulu</option>
            </Select>
          </div>
          <div className="flex gap-2">
            <Button onClick={exportCSV}>
              <IconDownload size={16} /> CSV
            </Button>
            <Button onClick={doPrint}>
              <IconPrinter size={16} /> Cetak
            </Button>
          </div>
        </div>
      </Card>

      {filteredSessions.length === 0 || filteredMembers.length === 0 ? (
        <EmptyState
          title="Belum ada data pada periode ini"
          desc="Pilih periode lain, atau isi absensi dulu di tab “Isi absensi”."
        />
      ) : (
        <>
          {/* Ringkasan */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Kehadiran" value={`${overallRate}%`} sub={`${totals.hadir} dari ${totalFilled} catatan`} accent="text-emerald-400" />
            <StatTile label="Sesi" value={filteredSessions.length} sub={month === 'all' ? 'semua periode' : month} />
            {ORDER.slice(1).map((k) => (
              <StatTile key={k} label={STATUS_META[k].label} value={totals[k]} />
            ))}
          </div>

          {/* D4 — Paket laporan admin */}
          <AdminReports data={dataLaporan} />

          {/* Tren per bulan (D2) */}
          {perMonth.length > 0 && (
            <Card>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-sm font-semibold text-slate-200">Tren kehadiran per bulan</h2>
                <span className="text-[11px] text-slate-500">
                  {perMonth.length} bulan · rata-rata 6 bulan terakhir{' '}
                  <span className="text-slate-300">{rataTren}%</span>
                  {banding && (
                    <>
                      {' '}· arah{' '}
                      <span
                        className={
                          banding.arah === 'naik'
                            ? 'text-emerald-400'
                            : banding.arah === 'turun'
                              ? 'text-rose-400'
                              : 'text-slate-300'
                        }
                      >
                        {banding.arah}
                      </span>
                    </>
                  )}
                </span>
              </div>

              {/* Batang per bulan — klik untuk memfilter rekap ke bulan itu */}
              <div className="flex h-32 items-stretch gap-1.5" data-testid="tren-bulan">
                {perMonth.map((m) => (
                  <button
                    key={m.key}
                    type="button"
                    onClick={() => setMonth((cur) => (cur === m.key ? 'all' : m.key))}
                    title={`${m.panjang} · ${m.rate}% (${m.hadir} dari ${m.filled}) · ${m.sesi} sesi — klik untuk memfilter`}
                    className="group flex h-full flex-1 flex-col justify-end gap-1"
                  >
                    <span className="text-[10px] tabular-nums text-slate-500 group-hover:text-slate-300">
                      {m.rate}%
                    </span>
                    <span
                      className={cx(
                        'w-full rounded-t-md transition',
                        m.key === month || (month === 'all' && m.key === bulanAktif)
                          ? 'bg-emerald-500'
                          : 'bg-emerald-600/45 group-hover:bg-emerald-500/80',
                      )}
                      style={{ height: `${Math.max(6, m.rate)}%` }}
                    />
                    <span className="w-full truncate text-center text-[10px] text-slate-500">{m.label}</span>
                  </button>
                ))}
              </div>

              {banding && (
                <p className="mt-3 text-xs leading-relaxed text-slate-400">
                  <b className="text-slate-200">{banding.terakhir.panjang}</b> {banding.terakhir.rate}%{' '}
                  dibanding <b className="text-slate-200">{banding.sebelum.panjang}</b> {banding.sebelum.rate}% →{' '}
                  <span
                    className={
                      banding.delta > 0
                        ? 'font-semibold text-emerald-400'
                        : banding.delta < 0
                          ? 'font-semibold text-rose-400'
                          : 'text-slate-300'
                    }
                  >
                    {banding.delta > 0 ? 'naik' : banding.delta < 0 ? 'turun' : 'stabil'}{' '}
                    {Math.abs(banding.delta)} poin
                  </span>
                  <span className="text-slate-600">
                    {' '}
                    · {banding.terakhir.sesi} sesi bulan ini, {banding.sebelum.sesi} sesi sebelumnya
                  </span>
                </p>
              )}
            </Card>
          )}

          {/* Perlu perhatian (D2) */}
          <Card>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-slate-200">
                Perlu perhatian{' '}
                <span className="text-slate-500">({perhatianIds.size})</span>
              </h2>
              <div className="flex items-center gap-2">
                <label className="text-[11px] text-slate-500">Ambang rendah</label>
                <Select
                  data-kiosk-allow
                  data-testid="pilih-batas-rendah"
                  value={String(batas)}
                  onChange={(e) => {
                    const v = Number(e.target.value)
                    // Memilih angka Cukup = kembali mengikuti Pengaturan.
                    setBatasManual(v === batasCukup ? null : v)
                  }}
                  className="w-36"
                >
                  {pilihanBatas.map((v) => (
                    <option key={v} value={v}>
                      &lt; {v}%{v === batasCukup ? ' (Cukup)' : ''}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            {batas !== batasCukup && (
              <p
                className="mb-2 rounded-lg border border-amber-500/25 bg-amber-500/10 px-2.5 py-1.5 text-[11px] leading-relaxed text-amber-200"
                data-testid="batas-beda-cukup"
              >
                Berbeda dari ambang predikat <b>Cukup ({batasCukup}%)</b> di Pengaturan — kartu kehadiran
                tetap memakai {batasCukup}%, jadi predikat di kartu dan daftar ini bisa tidak sepakat.{' '}
                <button
                  type="button"
                  data-testid="batas-ikut-cukup"
                  onClick={() => setBatasManual(null)}
                  className="text-amber-100 underline decoration-dotted"
                >
                  Kembali ke {batasCukup}%
                </button>
              </p>
            )}

            {!perhatianIds.size ? (
              <p className="text-xs text-slate-500">
                Tidak ada anggota di bawah {batas}% dan tidak ada yang kehadirannya turun tajam
                (≥10 poin) pada periode ini.
              </p>
            ) : (
              <div className="space-y-2.5" data-testid="perlu-perhatian">
                {rendah.length > 0 && (
                  <div>
                    <p className="mb-1 text-[11px] font-medium text-amber-300">
                      Kehadiran rendah (&lt; {batas}%) · {rendah.length} anggota
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {rendah.map((x) => (
                        <Badge key={x.member.id} className="border-amber-500/40 bg-amber-500/10 text-amber-200">
                          {x.member.name} · {x.rate}%
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {menurun.length > 0 && (
                  <div>
                    <p className="mb-1 text-[11px] font-medium text-rose-300">
                      Mulai menurun (turun ≥10 poin) · {menurun.length} anggota
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {menurun.map((x) => (
                        <Badge key={x.member.id} className="border-rose-500/40 bg-rose-500/10 text-rose-200">
                          {x.member.name} · {x.tren} poin
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                <label className="flex items-center gap-2 text-xs text-slate-400">
                  <input
                    type="checkbox"
                    checked={hanyaPerhatian}
                    onChange={(e) => setHanyaPerhatian(e.target.checked)}
                    className="h-4 w-4 accent-emerald-500"
                  />
                  Tampilkan hanya mereka di tabel per anggota
                </label>
              </div>
            )}
          </Card>

          {/* Grafik per sesi */}
          <Card>
            <h2 className="mb-3 text-sm font-semibold text-slate-200">Kehadiran per sesi</h2>
            <div className="space-y-2.5">
              {perSession.map(({ session: s, counts, total, rate }) => (
                <div key={s.id}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate text-slate-300">
                      {formatDateShort(s.date)} · {s.title}
                    </span>
                    <span className="shrink-0 tabular-nums text-slate-500">
                      {rate}% <span className="text-slate-600">({total})</span>
                    </span>
                  </div>
                  <div className="flex h-3 overflow-hidden rounded-full bg-slate-800">
                    {ORDER.map((k) =>
                      counts[k] ? (
                        <div
                          key={k}
                          title={`${STATUS_META[k].label}: ${counts[k]}`}
                          style={{ width: `${(counts[k] / Math.max(1, total)) * 100}%`, background: BAR[k] }}
                        />
                      ) : null,
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-slate-500">
              {ORDER.map((k) => (
                <span key={k} className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full" style={{ background: BAR[k] }} />
                  {STATUS_META[k].label}
                </span>
              ))}
            </div>
          </Card>

          {/* Per anggota */}
          <Card padded={false}>
            <div className="border-b border-slate-800 px-4 py-2.5">
              <h2 className="text-sm font-semibold text-slate-200">
                Rekap per anggota ({perMember.length})
              </h2>
            </div>
            <div className="scroll-thin max-h-[26rem] overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-slate-900/95 text-[10px] uppercase tracking-wide text-slate-500 backdrop-blur">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium">Anggota</th>
                    <th className="px-1 py-2 text-center font-medium">H</th>
                    <th className="px-1 py-2 text-center font-medium">I</th>
                    <th className="px-1 py-2 text-center font-medium">S</th>
                    <th className="px-1 py-2 text-center font-medium">A</th>
                    <th className="w-16 px-2 py-2 text-center font-medium">Tren</th>
                    <th className="w-28 px-3 py-2 text-right font-medium">Kehadiran</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70">
                  {perMember.map((x) => (
                    <tr key={x.member.id} className="hover:bg-slate-800/40">
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full"
                            style={{ background: BAR.hadir, opacity: 0.5 }}
                          />
                          <span className="truncate text-slate-200">{x.member.name}</span>
                          <Badge className="shrink-0">{x.member.code}</Badge>
                          {perhatianIds.has(x.member.id) && (
                            <span
                              title={
                                x.rate < batas
                                  ? `Kehadiran di bawah ${batas}%`
                                  : 'Kehadirannya menurun tajam dibanding bulan sebelumnya'
                              }
                              className="shrink-0 text-[13px] leading-none text-amber-400"
                            >
                              ⚠
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-500">{sectionLabel(x.member.section)}</p>
                      </td>
                      {ORDER.map((k) => (
                        <td key={k} className="px-1 py-2 text-center tabular-nums text-slate-400">
                          {x.counts[k] || ''}
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center tabular-nums">
                        {x.tren === null ? (
                          <span className="text-slate-600">–</span>
                        ) : (
                          <span
                            className={cx(
                              'text-[11px] font-semibold',
                              x.tren > 0 ? 'text-emerald-400' : x.tren < 0 ? 'text-rose-400' : 'text-slate-400',
                            )}
                          >
                            {x.tren > 0 ? '↑' : x.tren < 0 ? '↓' : '='}
                            {Math.abs(x.tren)}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-800">
                            <div
                              className={cx(
                                'h-full rounded-full',
                                x.rate >= 85 ? 'bg-emerald-500' : x.rate >= 70 ? 'bg-amber-500' : 'bg-rose-500',
                              )}
                              style={{ width: `${x.rate}%` }}
                            />
                          </div>
                          <span className="w-9 text-right tabular-nums text-slate-300">{x.rate}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Per section */}
          {perSection.length > 0 && (
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-slate-200">Rekap per section</h2>
              <div className="space-y-2">
                {perSection.map((x) => (
                  <div key={x.sec.id}>
                    <div className="mb-1 flex items-center justify-between text-xs">
                      <span className="flex items-center gap-2 text-slate-300">
                        <span className="h-2 w-2 rounded-full" style={{ background: x.sec.dot }} />
                        {x.sec.label}
                        <span className="text-slate-600">({x.anggota})</span>
                      </span>
                      <span className="tabular-nums text-slate-500">
                        {x.rate}% · H{x.counts.hadir} I{x.counts.izin} S{x.counts.sakit} A{x.counts.alpha}
                      </span>
                    </div>
                    <div className="flex h-2.5 overflow-hidden rounded-full bg-slate-800">
                      {ORDER.map((k) =>
                        x.counts[k] ? (
                          <div
                            key={k}
                            style={{ width: `${(x.counts[k] / Math.max(1, x.filled)) * 100}%`, background: BAR[k] }}
                          />
                        ) : null,
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* D3 — Kehadiran per jenis kegiatan */}
          {perJenis.length > 0 && (
            <Card data-testid="kartu-per-jenis">
              <h2 className="mb-1 text-sm font-semibold text-slate-200">Kehadiran per jenis kegiatan</h2>
              <p className="mb-3 text-[11px] text-slate-500">
                Membandingkan latihan section, latihan gabungan, dan penampilan dalam rentang yang dipilih.
              </p>
              <div className="space-y-3">
                {perJenis.map((x) => (
                  <div key={x.jenis} data-testid={`baris-jenis-${x.jenis}`}>
                    <div className="mb-1 flex items-center justify-between gap-2 text-xs">
                      <span className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${x.color}`}>
                        {x.label}
                      </span>
                      <span className="tabular-nums text-slate-400">
                        {x.sesi} sesi · <b className="text-slate-200">{x.rate}%</b> hadir ({x.h}/{x.f})
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${x.rate}%`,
                          background: x.rate >= 80 ? '#10b981' : x.rate >= 60 ? '#f59e0b' : '#f43f5e',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
