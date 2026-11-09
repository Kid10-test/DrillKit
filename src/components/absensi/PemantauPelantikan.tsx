/**
 * #36 — Absensi → Syarat pelantikan.
 *
 * Membaca program latihan (Jadwal → Program), daftar pesertanya, dan
 * catatan absensi sesi wajib, lalu menjawab per anak: sudah pasti lulus,
 * masih berjalan (berapa kali lagi boleh absen), kritis (wajib hadir di
 * semua sisa sesi), atau harus ikut pelantikan susulan saat camp.
 */
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import type { Member, PesertaProgram, ProgramLatihan } from '../../db/types'
import { db, saveSettings } from '../../db/db'
import { Button, Card, EmptyState, Input, Modal, Select, StatTile, useToast } from '../ui'
import { IconCheck, IconDownload } from '../Icons'
import { NamaTampil, useModeNama } from '../NamaTampil'
import { GarisWaktuProgram } from '../jadwal/GarisWaktuProgram'
import { cocokCari } from '../../lib/namaAnggota'
import { NAMA_BULAN } from '../../lib/kalender'
import { cetakAtauUnduh } from '../../lib/laporan'
import { htmlRekapPelantikan } from '../../lib/pelantikanCetak'
import {
  LABEL_KODE,
  LABEL_STATUS,
  SINGKAT_KODE,
  WARNA_KODE,
  WARNA_STATUS,
  barisCsvPelantikan,
  rekapPelantikan,
  tambahPeserta,
  tonggakCamp,
  urutkanRekap,
  type StatusPelantikan,
} from '../../lib/programLatsar'
import { downloadFile, sectionLabel, toCSV, todayISO } from '../../lib/utils'
import { useSettings } from '../../hooks/useSettings'

const tgl = (iso: string) => `${Number(iso.slice(8))} ${NAMA_BULAN[Number(iso.slice(5, 7)) - 1]?.slice(0, 3) ?? ''}`
const SARING: (StatusPelantikan | 'semua')[] = ['semua', 'susulan', 'kritis', 'berjalan', 'lulus']

export default function PemantauPelantikan() {
  const settings = useSettings()
  const toast = useToast()
  const daftar = settings.programLatihan ?? []
  const [pilih, setPilih] = useState('')
  const program = daftar.find((p) => p.id === pilih) ?? daftar[daftar.length - 1] ?? null
  const anggota = useLiveQuery(() => db.members.toArray(), [], [] as Member[])
  const sesi = useLiveQuery(() => db.sessions.toArray(), [], [])
  const ids = useMemo(() => program?.wajibIds ?? [], [program])
  const catatan = useLiveQuery(() => (ids.length ? db.attendance.where('sessionId').anyOf(ids).toArray() : []), [ids.join(',')], [])
  const hariIni = todayISO()
  const [saring, setSaring] = useState<StatusPelantikan | 'semua'>('semua')
  const [seksi, setSeksi] = useState('')
  const [q, setQ] = useState('')
  const [kelola, setKelola] = useState(false)
  useModeNama()

  const rekap = useMemo(
    () => (program ? rekapPelantikan(program, anggota, sesi, catatan, hariIni) : null),
    [program, anggota, sesi, catatan, hariIni],
  )
  if (!program || !rekap) return null
  const camp = tonggakCamp(program)
  const baris = urutkanRekap(rekap.baris).filter(
    (b) =>
      (saring === 'semua' || b.status === saring) &&
      (!seksi || b.anggota?.section === seksi) &&
      (!q.trim() || (b.anggota && cocokCari(b.anggota, q.trim().toLowerCase()))),
  )
  const susulan = urutkanRekap(rekap.baris).filter((b) => b.status === 'susulan')
  const seksiAda = [...new Set(rekap.baris.map((b) => b.anggota?.section).filter(Boolean) as string[])]
  const lewat = rekap.wajib.filter((s) => s.date < hariIni).length

  function eksporCsv() {
    downloadFile(`syarat-pelantikan-${program!.nama.replace(/\s+/g, '-').toLowerCase()}-${hariIni}.csv`, toCSV(barisCsvPelantikan(rekap!, sectionLabel)), 'text/csv')
  }
  function cetak() {
    const html = htmlRekapPelantikan(program!, rekap!, { namaTim: settings.teamName, label: sectionLabel, hariIni })
    if (!cetakAtauUnduh(html, `syarat-pelantikan-${hariIni}.html`)) toast.push('Jendela cetak diblokir — berkas HTML diunduh, buka lalu tekan Ctrl+P', 'info')
  }

  return (
    <div className="space-y-4" data-testid="pemantau-pelantikan">
      <Card className="space-y-2 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {daftar.length > 1 ? (
            <div className="w-56">
              <Select data-testid="pemantau-program" value={program.id} onChange={(e) => setPilih(e.target.value)}>
                {daftar.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.nama}
                  </option>
                ))}
              </Select>
            </div>
          ) : (
            <h2 className="text-sm font-semibold text-slate-100">{program.nama}</h2>
          )}
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" data-testid="kelola-peserta" onClick={() => setKelola(true)}>
              Peserta ({program.peserta.length})
            </Button>
            <Button size="sm" data-testid="ekspor-pelantikan" onClick={eksporCsv} disabled={!program.peserta.length}>
              <IconDownload size={14} /> CSV
            </Button>
            <Button size="sm" data-testid="cetak-pelantikan" onClick={cetak} disabled={!program.peserta.length}>
              Cetak A4
            </Button>
          </div>
        </div>
        <GarisWaktuProgram program={program} wajib={new Set(rekap.wajib.map((s) => s.date))} hariIni={hariIni} />
        <p data-testid="aturan-pelantikan" className="text-[11px] text-slate-400">
          Lulus: hadir ≥ <b className="text-slate-200">{program.aturan.persenMin}%</b> dari{' '}
          <b className="text-slate-200">{rekap.wajib.length} sesi wajib</b> (dikurangi izin/sakit sah) dan minimal{' '}
          <b className="text-slate-200">{program.aturan.hadirMin}×</b> hadir fisik · izin tertulis sebelum jam mulai · sakit ≤{' '}
          {program.aturan.sakitMaksJam} jam
          {program.aturan.batasGabung && <> · bergabung paling lambat {tgl(program.aturan.batasGabung)}</>} · {lewat}/{rekap.wajib.length} sesi
          wajib sudah lewat
        </p>
      </Card>

      {program.peserta.length === 0 ? (
        <EmptyState
          icon={<IconCheck size={28} />}
          title="Belum ada peserta"
          desc="Pilih anggota yang ikut program ini — misalnya semua anggota tahun masuk tahun ini."
          action={
            <Button variant="primary" data-testid="kelola-peserta-kosong" onClick={() => setKelola(true)}>
              Pilih peserta
            </Button>
          }
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-testid="ringkas-pelantikan">
            {(['lulus', 'berjalan', 'kritis', 'susulan'] as const).map((s) => (
              <button key={s} type="button" data-testid={`jumlah-${s}`} onClick={() => setSaring(saring === s ? 'semua' : s)} className="text-left">
                <StatTile label={LABEL_STATUS[s]} value={rekap.jumlah[s]} accent={s === 'lulus' ? 'text-emerald-400' : s === 'berjalan' ? 'text-sky-400' : s === 'kritis' ? 'text-amber-400' : 'text-rose-400'} />
              </button>
            ))}
          </div>

          {rekap.tanpaCap > 0 && (
            <p data-testid="peringatan-tanpa-cap" className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-200">
              {rekap.tanpaCap} catatan izin/sakit di sesi wajib belum punya jam lapor dan sementara dihitung tanpa keterangan. Lengkapi
              di <b>Isi absensi</b> (ketuk label “jam lapor?” di samping nama).
            </p>
          )}

          <Card className="space-y-2 p-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {SARING.map((s) => (
                <button
                  key={s}
                  type="button"
                  data-testid={`saring-${s}`}
                  aria-pressed={saring === s}
                  onClick={() => setSaring(s)}
                  className={`rounded-md border px-2 py-1 text-xs ${saring === s ? 'border-emerald-500 bg-emerald-500/20 text-emerald-200' : 'border-slate-600 text-slate-400'}`}
                >
                  {s === 'semua' ? `Semua (${rekap.baris.length})` : `${LABEL_STATUS[s]} (${rekap.jumlah[s]})`}
                </button>
              ))}
              <div className="w-36">
                <Select data-testid="saring-seksi" value={seksi} onChange={(e) => setSeksi(e.target.value)}>
                  <option value="">Semua seksi</option>
                  {seksiAda.map((s) => (
                    <option key={s} value={s}>
                      {sectionLabel(s)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="w-40">
                <Input data-testid="cari-pelantikan" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama…" />
              </div>
            </div>
            <ul className="divide-y divide-slate-800/70" data-testid="daftar-pelantikan">
              {baris.map((b) => (
                <li key={b.memberId} data-testid={`peserta-${b.memberId}`} data-status={b.status} className="space-y-1 py-2">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-slate-100">
                      {b.anggota ? <NamaTampil anggota={b.anggota} /> : '(anggota terhapus)'}
                      <span className="ml-1.5 text-[11px] font-normal text-slate-500">{b.anggota ? sectionLabel(b.anggota.section) : ''}</span>
                    </span>
                    <span className="text-[11px] tabular-nums text-slate-300" title="hadir / dibutuhkan">
                      hadir <b>{b.hadir}</b>/{b.butuh}
                    </span>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: WARNA_STATUS[b.status] }} data-testid={`status-${b.memberId}`}>
                      {LABEL_STATUS[b.status]}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <div className="flex flex-wrap gap-0.5" aria-label="Kehadiran per sesi wajib">
                      {b.rincian.map((k, i) => (
                        <span
                          key={rekap.wajib[i].id}
                          title={`${tgl(rekap.wajib[i].date)}: ${k == null ? 'sebelum bergabung' : LABEL_KODE[k]}`}
                          className="flex h-4 w-4 items-center justify-center rounded-sm text-[8px] font-bold"
                          style={
                            k == null
                              ? { border: '1px dashed #475569' }
                              : k === 'mendatang'
                                ? { border: '1px solid #475569' }
                                : { background: WARNA_KODE[k], color: '#ffffff' }
                          }
                        >
                          {k == null || k === 'mendatang' ? '' : SINGKAT_KODE[k].slice(0, 1)}
                        </span>
                      ))}
                    </div>
                    <span className="min-w-0 text-[11px] text-slate-400" data-testid={`alasan-${b.memberId}`}>
                      {b.alasan}
                    </span>
                  </div>
                </li>
              ))}
              {baris.length === 0 && <li className="py-3 text-sm text-slate-500">Tidak ada peserta yang cocok.</li>}
            </ul>
            <p className="text-[10px] text-slate-500">
              {(['hadir', 'izin-sah', 'sakit-sah', 'izin-telat', 'sakit-telat', 'tanpa-cap', 'alpha', 'kosong'] as const).map((k) => (
                <span key={k} className="mr-2 inline-flex items-center gap-1">
                  <i className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: WARNA_KODE[k] }} />
                  {LABEL_KODE[k]}
                </span>
              ))}
            </p>
          </Card>

          <Card className="space-y-1 p-3" data-testid="daftar-susulan">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-rose-300">
              Pelantikan susulan{camp ? ` · ${camp.nama} ${camp.dari ? tgl(camp.dari) : '(tanggal belum ditentukan)'}` : ''} · {susulan.length} orang
            </h3>
            {susulan.length === 0 ? (
              <p className="text-[12px] text-slate-500">Belum ada yang pasti harus susulan.</p>
            ) : (
              <ul className="space-y-0.5 text-[12px] text-slate-300">
                {susulan.map((b) => (
                  <li key={b.memberId}>
                    {b.anggota ? <NamaTampil anggota={b.anggota} /> : '(anggota terhapus)'}{' '}
                    <span className="text-slate-500">
                      · {b.anggota ? sectionLabel(b.anggota.section) : ''} · {b.alasan}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </>
      )}

      <KelolaPeserta open={kelola} onClose={() => setKelola(false)} program={program} anggota={anggota} />
    </div>
  )
}

function KelolaPeserta({
  open,
  onClose,
  program,
  anggota,
}: {
  open: boolean
  onClose: () => void
  program: ProgramLatihan
  anggota: Member[]
}) {
  const settings = useSettings()
  const toast = useToast()
  const [pilih, setPilih] = useState<Record<string, string>>({})
  const [tahun, setTahun] = useState('')
  const [seksi, setSeksi] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    if (open) setPilih(Object.fromEntries(program.peserta.map((x) => [x.memberId, x.bergabung])))
    // Hanya saat dibuka / ganti program — jangan menimpa centang yang sedang diubah.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, program.id])
  const aktif = anggota.filter((m) => m.active || pilih[m.id]).sort((a, b) => a.section.localeCompare(b.section) || a.name.localeCompare(b.name, 'id'))
  const daftarTahun = [...new Set(aktif.map((m) => m.joinYear))].sort((a, b) => b - a)
  const tampil = aktif.filter(
    (m) => (!tahun || String(m.joinYear) === tahun) && (!seksi || m.section === seksi) && (!q.trim() || cocokCari(m, q.trim().toLowerCase())),
  )
  const jumlah = Object.keys(pilih).length

  async function simpan() {
    const lama = new Map(program.peserta.map((x) => [x.memberId, x]))
    const peserta: PesertaProgram[] = Object.entries(pilih).map(([memberId, bergabung]) => ({
      ...(lama.get(memberId) ?? {}),
      memberId,
      bergabung: bergabung || program.mulai,
    }))
    const baru = { ...program, peserta: tambahPeserta({ ...program, peserta }, []), diubah: Date.now() }
    await saveSettings({ programLatihan: (settings.programLatihan ?? []).map((p) => (p.id === program.id ? baru : p)) })
    toast.push(`${peserta.length} peserta disimpan`)
    onClose()
  }

  return (
    <Modal open={open} onClose={onClose} title={`Peserta — ${program.nama}`} wide testId="modal-peserta">
      <p className="text-[12px] text-slate-400">
        Centang anggota yang ikut. Tanggal bergabung menentukan sesi wajib yang dihitung — anak yang masuk belakangan hanya
        dihitung sejak tanggalnya
        {program.aturan.batasGabung ? `, dan yang bergabung sesudah ${tgl(program.aturan.batasGabung)} otomatis masuk daftar susulan` : ''}.
      </p>
      <div className="flex flex-wrap items-center gap-1.5">
        <div className="w-36">
          <Select data-testid="peserta-tahun" value={tahun} onChange={(e) => setTahun(e.target.value)}>
            <option value="">Semua tahun masuk</option>
            {daftarTahun.map((t) => (
              <option key={t} value={t}>
                Tahun masuk {t}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-36">
          <Select data-testid="peserta-seksi" value={seksi} onChange={(e) => setSeksi(e.target.value)}>
            <option value="">Semua seksi</option>
            {[...new Set(aktif.map((m) => m.section))].map((s) => (
              <option key={s} value={s}>
                {sectionLabel(s)}
              </option>
            ))}
          </Select>
        </div>
        <div className="w-40">
          <Input data-testid="peserta-cari" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari…" />
        </div>
        <Button
          size="sm"
          data-testid="peserta-pilih-semua"
          onClick={() => setPilih({ ...pilih, ...Object.fromEntries(tampil.filter((m) => !pilih[m.id]).map((m) => [m.id, program.mulai])) })}
        >
          Pilih {tampil.length} yang tampil
        </Button>
        <Button
          size="sm"
          variant="ghost"
          data-testid="peserta-lepas-semua"
          onClick={() => {
            const x = { ...pilih }
            for (const m of tampil) delete x[m.id]
            setPilih(x)
          }}
        >
          Lepas yang tampil
        </Button>
      </div>
      <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-slate-800">
        <ul className="divide-y divide-slate-800/70">
          {tampil.map((m) => {
            const on = m.id in pilih
            return (
              <li key={m.id} className="flex flex-wrap items-center gap-2 px-2 py-1.5">
                <label className="flex min-w-0 flex-1 items-center gap-2 text-sm text-slate-200">
                  <input
                    type="checkbox"
                    data-testid={`peserta-cek-${m.id}`}
                    checked={on}
                    onChange={(e) => {
                      const x = { ...pilih }
                      if (e.target.checked) x[m.id] = program.mulai
                      else delete x[m.id]
                      setPilih(x)
                    }}
                  />
                  <span className="min-w-0 truncate">
                    <NamaTampil anggota={m} />
                    <span className="ml-1.5 text-[11px] text-slate-500">
                      {sectionLabel(m.section)} · {m.joinYear}
                    </span>
                  </span>
                </label>
                {on && (
                  <label className="flex items-center gap-1 text-[11px] text-slate-400">
                    bergabung
                    <span className="w-36">
                      <Input type="date" data-testid={`peserta-gabung-${m.id}`} value={pilih[m.id]} onChange={(e) => setPilih({ ...pilih, [m.id]: e.target.value })} />
                    </span>
                  </label>
                )}
              </li>
            )
          })}
          {tampil.length === 0 && <li className="px-2 py-3 text-sm text-slate-500">Tidak ada anggota yang cocok.</li>}
        </ul>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-slate-400" data-testid="peserta-jumlah">
          {jumlah} dipilih
        </span>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" data-testid="peserta-simpan" onClick={simpan}>
            Simpan peserta
          </Button>
        </div>
      </div>
    </Modal>
  )
}
