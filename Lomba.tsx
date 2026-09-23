/**
 * G1 — Run sheet hari lomba.
 *
 * Menyajikan seluruh sesi pada satu tanggal sebagai satu linimasa, lengkap
 * dengan **apa yang dibawakan** di tiap slot dan apakah isinya muat.
 *
 * Sesi sendiri tetap dibuat & disunting di halaman Jadwal; halaman ini hanya
 * melengkapinya dengan tautan set list, lalu menilai kecukupan waktunya.
 * Memisahkannya sengaja: jadwal untuk merencanakan, run sheet untuk
 * memeriksa hari H.
 */
import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Session } from '../db/types'
import { PageHeader, Button, Card, Field, Select, EmptyState, useToast } from '../components/ui'
import {
  LABEL_JENIS,
  bisaBerisiSetList,
  formatDetik,
  jamDariMenit,
  susunRunSheet,
} from '../lib/runsheet'
import type { BarisRun } from '../lib/runsheet'
import { downloadHtmlFile, esc, printHtml, printShell } from '../lib/print'
import { IconPrinter, IconDownload, IconExpand } from '../components/Icons'
import { ModeLomba } from '../components/ModeLomba'

/** Tanggal hari ini dalam format ISO (YYYY-MM-DD), zona waktu setempat. */
function hariIni(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Tanggal sesi terdekat yang akan datang; kalau tidak ada, hari ini. */
function tanggalTerdekat(sessions: Session[]): string {
  const kini = hariIni()
  const nanti = sessions
    .map((s) => s.date)
    .filter((d) => d && d >= kini)
    .sort()[0]
  return nanti ?? kini
}

function formatTanggal(iso: string): string {
  const p = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!p) return iso
  const d = new Date(Number(p[1]), Number(p[2]) - 1, Number(p[3]))
  return d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
}

export default function Lomba() {
  const toast = useToast()
  const sessions = useLiveQuery(() => db.sessions.toArray(), [], [])
  const setlists = useLiveQuery(() => db.setlists.orderBy('updatedAt').reverse().toArray(), [], [])
  const songs = useLiveQuery(() => db.songs.toArray(), [], [])
  const settings = useLiveQuery(() => db.settings.get('team'), [], undefined)

  const [modeLomba, setModeLomba] = useState(false)
  const [tanggal, setTanggal] = useState<string | null>(null)
  // Tanggal bawaan baru ditentukan setelah sesi terbaca, supaya tidak
  // memakai "hari ini" untuk tim yang jadwalnya sudah lewat semua.
  const tanggalAktif = tanggal ?? tanggalTerdekat(sessions ?? [])

  const run = useMemo(
    () =>
      susunRunSheet({
        tanggal: tanggalAktif,
        sessions: sessions ?? [],
        setlists: setlists ?? [],
        songs: songs ?? [],
      }),
    [tanggalAktif, sessions, setlists, songs],
  )

  const pilihSetList = async (sesiId: string, setListId: string) => {
    await db.sessions.update(sesiId, { setListId: setListId || undefined })
  }

  /* ------------------------------- Cetak -------------------------------- */
  function susunHtml(): string {
    const css = `
      body { padding: 24px; font-size: 12px; }
      h1 { font-size: 17px; margin: 0 0 2px; }
      .sub { color:#555; font-size: 11px; margin: 0 0 14px; }
      table { width:100%; border-collapse: collapse; }
      th, td { border: 1px solid #cbd5e1; padding: 5px 7px; text-align: left; vertical-align: top; }
      th { background:#f1f5f9; font-size: 10px; text-transform: uppercase; letter-spacing:.04em; }
      tr.melebihi td { background:#fef2f2; }
      tr.takPasti td { background:#fffbeb; }
      .angka { font-variant-numeric: tabular-nums; white-space: nowrap; }
      .peringatan { margin-top: 14px; border: 1px solid #fca5a5; background:#fef2f2; padding: 10px 12px; border-radius: 6px; }
      .peringatan ul { margin: 6px 0 0 16px; padding: 0; }
      .peringatan li { margin-bottom: 3px; }
      .aman { margin-top: 14px; border: 1px solid #86efac; background:#f0fdf4; padding: 10px 12px; border-radius: 6px; }
      .catatan { color:#444; font-size: 11px; }
    `
    const baris = run.baris
      .map(
        (b) => `<tr class="${b.status}">
          <td class="angka">${b.mulai != null ? jamDariMenit(b.mulai) : '—'}–${
            b.selesai != null ? jamDariMenit(b.selesai) : '—'
          }</td>
          <td><b>${esc(b.judul)}</b><br><span class="catatan">${esc(LABEL_JENIS[b.jenis])}${
            b.tempat ? ` · ${esc(b.tempat)}` : ''
          }</span></td>
          <td>${b.namaSetList ? esc(b.namaSetList) : '<span class="catatan">—</span>'}</td>
          <td class="angka">${b.lamaSlot != null ? `${b.lamaSlot} mnt` : '—'}</td>
          <td class="angka">${b.lamaIsi != null ? formatDetik(b.lamaIsi) : '—'}${
            b.tanpaPanjang ? ' <span class="catatan">(?)</span>' : ''
          }</td>
          <td>${b.catatan ? `<span class="catatan">${esc(b.catatan)}</span>` : ''}</td>
        </tr>`,
      )
      .join('')

    const tubuh = `
      <h1>Run sheet — ${esc(settings?.teamName ?? 'Tim')}</h1>
      <p class="sub">${esc(formatTanggal(run.tanggal))} · ${run.baris.length} sesi · total slot ${
        run.totalSlot
      } menit · total isi ${formatDetik(run.totalIsi)}</p>
      <table>
        <thead><tr>
          <th>Waktu</th><th>Kegiatan</th><th>Set list</th><th>Slot</th><th>Isi</th><th>Catatan</th>
        </tr></thead>
        <tbody>${baris || '<tr><td colspan="6">Tidak ada sesi pada tanggal ini.</td></tr>'}</tbody>
      </table>
      ${
        run.peringatan.length
          ? `<div class="peringatan"><b>Perlu diperhatikan sebelum hari H:</b><ul>${run.peringatan
              .map((p) => `<li>${esc(p)}</li>`)
              .join('')}</ul></div>`
          : '<div class="aman">Semua slot cukup dan tidak ada yang tumpang-tindih.</div>'
      }
    `
    return printShell(`Run sheet ${run.tanggal}`, tubuh, css)
  }

  return (
    <div>
      <PageHeader
        title="Run sheet hari lomba"
        subtitle="Linimasa satu hari lengkap — apa yang dibawakan, dan apakah muat waktunya"
        actions={
          <>
            <Button onClick={() => void (location.hash = '#/jadwal')}>
              Ke halaman Jadwal
            </Button>
            <Button
              data-testid="unduh-runsheet"
              onClick={() => {
                downloadHtmlFile(susunHtml(), `run-sheet-${run.tanggal}.html`)
                toast.push('Run sheet diunduh')
              }}
            >
              <IconDownload size={16} /> Unduh
            </Button>
            <Button
              data-testid="buka-mode-lomba"
              onClick={() => setModeLomba(true)}
              title="Tampilan besar untuk hari H: jam berjalan, hitung mundur, dan apa yang disiapkan berikutnya"
            >
              <IconExpand size={16} /> Mode lomba
            </Button>
            <Button
              variant="primary"
              data-testid="cetak-runsheet"
              onClick={() => {
                if (!printHtml(susunHtml())) {
                  toast.push('Browser memblokir jendela cetak — gunakan tombol Unduh', 'err')
                }
              }}
            >
              <IconPrinter size={16} /> Cetak
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]">
        <Card>
          <Field label="Tanggal" hint="Run sheet disusun dari sesi pada tanggal ini">
            <input
              type="date"
              data-testid="pilih-tanggal"
              value={tanggalAktif}
              onChange={(e) => setTanggal(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
            />
          </Field>
          <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
            Sesi dibuat & diubah di halaman <b>Jadwal</b>. Di sini Anda hanya
            menautkan set list ke tiap penampilan, lalu memeriksa apakah isinya
            muat di slotnya.
          </p>
        </Card>

        <Card className="sm:w-64">
          <div className="grid grid-cols-2 gap-3 text-center">
            <div data-testid="ringkasan-sesi">
              <div className="text-[15px] font-semibold text-slate-100">{run.baris.length}</div>
              <div className="text-[10px] leading-tight text-slate-500">sesi hari ini</div>
            </div>
            <div data-testid="ringkasan-slot">
              <div className="text-[15px] font-semibold text-slate-100">{run.totalSlot}</div>
              <div className="text-[10px] leading-tight text-slate-500">menit total slot</div>
            </div>
            <div data-testid="ringkasan-isi">
              <div className="text-[15px] font-semibold text-slate-100">
                {formatDetik(run.totalIsi)}
              </div>
              <div className="text-[10px] leading-tight text-slate-500">total isi tampil</div>
            </div>
            <div data-testid="ringkasan-peringatan">
              <div
                className="text-[15px] font-semibold"
                style={{ color: run.peringatan.length ? '#fca5a5' : '#86efac' }}
              >
                {run.peringatan.length}
              </div>
              <div className="text-[10px] leading-tight text-slate-500">perlu perhatian</div>
            </div>
          </div>
        </Card>
      </div>

      {run.peringatan.length > 0 && (
        <Card className="mb-4 border-amber-600/30">
          <h2 className="mb-2 text-sm font-semibold text-amber-300">
            Perlu diperhatikan sebelum hari H
          </h2>
          <ul className="space-y-1" data-testid="daftar-peringatan">
            {run.peringatan.map((p, i) => (
              <li key={i} className="text-xs leading-relaxed text-amber-100/90">
                • {p}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {!run.baris.length ? (
        <EmptyState
          icon={<IconPrinter size={28} />}
          title="Belum ada sesi pada tanggal ini"
          desc="Buat sesi dulu di halaman Jadwal, atau pilih tanggal lain."
        />
      ) : (
        <div className="space-y-2" data-testid="linimasa">
          {run.baris.map((b) => (
            <Baris
              key={b.id}
              b={b}
              setlists={setlists ?? []}
              onChange={(id) => void pilihSetList(b.id, id)}
            />
          ))}
        </div>
      )}

      {modeLomba && (
        <ModeLomba
          run={run}
          songs={songs ?? []}
          setlists={setlists ?? []}
          onClose={() => setModeLomba(false)}
        />
      )}
    </div>
  )
}

/* -------------------------------------------------------------------------- */

const WARNA_STATUS: Record<BarisRun['status'], string> = {
  cukup: 'border-emerald-600/30',
  melebihi: 'border-rose-600/50 bg-rose-950/20',
  takPasti: 'border-amber-600/40 bg-amber-950/10',
  tanpaIsi: 'border-slate-800',
  slotTakSah: 'border-slate-700 bg-slate-800/30',
}

function Baris({
  b,
  setlists,
  onChange,
}: {
  b: BarisRun
  setlists: { id: string; name: string }[]
  onChange: (setListId: string) => void
}) {
  const jam =
    b.mulai != null && b.selesai != null
      ? `${jamDariMenit(b.mulai)}–${jamDariMenit(b.selesai)}`
      : 'waktu tidak terbaca'

  return (
    <div
      className={`rounded-lg border p-3 ${WARNA_STATUS[b.status]}`}
      data-testid={`baris-run-${b.id}`}
      data-status={b.status}
    >
      <div className="flex flex-wrap items-start gap-x-3 gap-y-1">
        <span className="w-28 shrink-0 text-sm font-semibold tabular-nums text-slate-100">
          {jam}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-100">{b.judul}</p>
          <p className="text-[11px] text-slate-500">
            {LABEL_JENIS[b.jenis]}
            {b.tempat ? ` · ${b.tempat}` : ''}
            {b.lamaSlot != null ? ` · slot ${b.lamaSlot} menit` : ''}
            {b.lamaIsi != null ? ` · isi ${formatDetik(b.lamaIsi)}` : ''}
            {b.tanpaPanjang ? ' (perkiraan)' : ''}
          </p>
          {b.catatan && <p className="mt-0.5 text-[11px] text-slate-400">{b.catatan}</p>}
        </div>
        <div className="shrink-0 text-right">
          <StatusTanda status={b.status} />
          {b.jeda != null && (
            <p className="mt-0.5 text-[10px] tabular-nums text-slate-500">
              {b.jeda < 0 ? `bentrok ${Math.abs(b.jeda)} mnt` : `jeda ${b.jeda} mnt`}
            </p>
          )}
        </div>
      </div>

      {bisaBerisiSetList(b.jenis) && (
        <div className="mt-2 border-t border-slate-800 pt-2">
          <Select
            data-testid={`setlist-${b.id}`}
            value={b.setListId ?? ''}
            onChange={(e) => onChange(e.target.value)}
            className="text-xs"
          >
            <option value="">— tanpa set list —</option>
            {setlists.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
        </div>
      )}
    </div>
  )
}

function StatusTanda({ status }: { status: BarisRun['status'] }) {
  const peta: Record<BarisRun['status'], { teks: string; kelas: string }> = {
    cukup: { teks: 'cukup', kelas: 'text-emerald-300' },
    melebihi: { teks: 'TIDAK MUAT', kelas: 'text-rose-300 font-semibold' },
    takPasti: { teks: 'perkiraan', kelas: 'text-amber-300' },
    tanpaIsi: { teks: '', kelas: 'text-slate-600' },
    slotTakSah: { teks: 'waktu?', kelas: 'text-slate-400' },
  }
  const p = peta[status]
  return <span className={`text-[11px] ${p.kelas}`}>{p.teks}</span>
}
