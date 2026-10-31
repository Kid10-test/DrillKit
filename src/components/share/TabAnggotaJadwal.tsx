import { useMemo, useState } from "react"
import type { AttendanceRecord, Session } from "../../db/types"
import { Badge, Button, Card, EmptyState } from "../ui"
import { STATUS_META, cx, formatDateLong, nowTime, relativeDay, sesiMeta, todayISO } from "../../lib/utils"
import { PengingatJadwal, unduhICS } from "../PengingatJadwal"
import {
  NAMA_BULAN,
  NAMA_HARI_PANJANG,
  NAMA_HARI_SENIN,
  KUNCI_TAMPILAN,
  geserBulan,
  kelompokPerMinggu,
  hariSenin,
  sesiBerikutnya,
  sesiPerTanggal,
  susunBulan,
  teksHitungMundur,
  tampilanAwal,
} from "../../lib/kalender"

function bacaTampilanJadwalAnggota(): 'bulan' | 'agenda' {
  let tersimpan: string | null = null
  try {
    tersimpan = localStorage.getItem(KUNCI_TAMPILAN)
  } catch {
    /* localStorage diblokir — ikuti ukuran layar */
  }
  const awal = tampilanAwal(tersimpan, typeof window !== 'undefined' ? window.innerWidth : 1024)
  return awal === 'bulan' ? 'bulan' : 'agenda'
}

/**
 * Kalender anggota adalah salinan baca-saja dari jadwal pelatih.
 *
 * Hal yang sengaja berbeda dari kalender pelatih:
 * - tidak ada tombol tambah/edit/hapus, seret-pindah, checklist, atau Pacu;
 * - status yang ditampilkan hanya status anggota yang sedang dipilih;
 * - `attendance === null` berarti bagian terkunci #2 belum dibuka. Dalam
 *   keadaan itu kalender tidak menebak "alpha" dan tidak membaca absensi
 *   terbuka dari paket grup.
 */
export function MemberSchedule({
  sessions,
  attendance,
}: {
  sessions: Session[]
  /** null = data pribadi terkunci/belum tersedia; [] = sudah dibuka, nihil catatan */
  attendance: AttendanceRecord[] | null
}) {
  const hariIni = todayISO()
  const [tampilan, setTampilan] = useState<'bulan' | 'agenda'>(bacaTampilanJadwalAnggota)
  const [bulanAktif, setBulanAktif] = useState(() => ({
    tahun: Number(hariIni.slice(0, 4)),
    bulan: Number(hariIni.slice(5, 7)),
  }))
  const [hariPilih, setHariPilih] = useState(hariIni)
  const [lihatLewat, setLihatLewat] = useState(false)
  const [buka, setBuka] = useState<string | null>(null)

  function pilihTampilan(next: 'bulan' | 'agenda') {
    setTampilan(next)
    try {
      localStorage.setItem(KUNCI_TAMPILAN, next)
    } catch {
      /* abaikan */
    }
  }

  const perTanggal = useMemo(() => sesiPerTanggal(sessions), [sessions])
  const minggu = useMemo(
    () => susunBulan(bulanAktif.tahun, bulanAktif.bulan),
    [bulanAktif.bulan, bulanAktif.tahun],
  )
  const pilihan = perTanggal.get(hariPilih) ?? []
  const berikutnya = useMemo(
    () => sesiBerikutnya(sessions, hariIni, nowTime()),
    [sessions, hariIni],
  )
  const mendatang = useMemo(
    () => sessions.filter((s) => s.id !== berikutnya?.id && s.date >= hariIni),
    [sessions, berikutnya?.id, hariIni],
  )
  const lewat = useMemo(
    () => sessions.filter((s) => s.date < hariIni || (s.date === hariIni && s.id !== berikutnya?.id && !mendatang.some((x) => x.id === s.id))),
    [sessions, hariIni, berikutnya?.id, mendatang],
  )
  const kelompok = useMemo(() => kelompokPerMinggu(mendatang, hariIni), [mendatang, hariIni])
  const kelompokLewat = useMemo(() => kelompokPerMinggu(lewat, hariIni).reverse(), [lewat, hariIni])

  const statusUntuk = (s: Session) => attendance?.find((a) => a.sessionId === s.id)
  const jumlahDicatat = attendance?.length ?? 0
  const hadir = attendance?.filter((a) => a.status === 'hadir').length ?? 0
  const statusTerbuka = attendance !== null

  return (
    <div className="space-y-4" data-kiosk-allow data-testid="kalender-anggota">
      <PengingatJadwal sessions={sessions} prefix="ingat-anggota" />

      <Card className="p-2 sm:p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">Kalender tim</h2>
            <p className="text-[11px] text-slate-500">Jadwal pelatih · hanya untuk dilihat</p>
          </div>
          <div className="flex rounded-lg border border-slate-700 p-0.5" role="tablist" aria-label="Tampilan jadwal anggota">
            <button
              type="button"
              role="tab"
              data-testid="anggota-tampilan-bulan"
              aria-selected={tampilan === 'bulan'}
              onClick={() => pilihTampilan('bulan')}
              className={cx('rounded-md px-2.5 py-1.5 text-xs font-medium', tampilan === 'bulan' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-100')}
            >
              Bulan
            </button>
            <button
              type="button"
              role="tab"
              data-testid="anggota-tampilan-agenda"
              aria-selected={tampilan === 'agenda'}
              onClick={() => pilihTampilan('agenda')}
              className={cx('rounded-md px-2.5 py-1.5 text-xs font-medium', tampilan === 'agenda' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-slate-100')}
            >
              Agenda
            </button>
          </div>
        </div>

        {statusTerbuka ? (
          <p data-testid="status-kehadiran-anggota" className="mt-3 rounded-lg border border-emerald-800/40 bg-emerald-950/20 px-3 py-2 text-[11px] leading-relaxed text-emerald-300">
            Status kehadiranmu dari catatan pelatih: <b>{hadir} hadir</b> dari {jumlahDicatat} sesi yang dicatat.
          </p>
        ) : (
          <p data-testid="status-kehadiran-anggota" className="mt-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-[11px] leading-relaxed text-slate-400">
            Status kehadiran pribadi masih terkunci. Minta QR kunci pribadi ke pelatih, lalu tekan Perbarui.
          </p>
        )}
      </Card>

      {tampilan === 'bulan' ? (
        <div className="lg:grid lg:grid-cols-[1fr_22rem] lg:gap-4" data-testid="kalender-anggota-bulan">
          <Card className="p-2 sm:p-3">
            <div className="mb-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <Button
                  size="sm"
                  variant="ghost"
                  data-testid="anggota-bulan-mundur"
                  onClick={() => setBulanAktif((b) => geserBulan(b.tahun, b.bulan, -1))}
                  aria-label="Bulan sebelumnya"
                >
                  ‹
                </Button>
                <h3 data-testid="anggota-judul-bulan" className="min-w-[9rem] text-center text-sm font-semibold text-slate-100">
                  {NAMA_BULAN[bulanAktif.bulan - 1]} {bulanAktif.tahun}
                </h3>
                <Button
                  size="sm"
                  variant="ghost"
                  data-testid="anggota-bulan-maju"
                  onClick={() => setBulanAktif((b) => geserBulan(b.tahun, b.bulan, 1))}
                  aria-label="Bulan berikutnya"
                >
                  ›
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                data-testid="anggota-hari-ini"
                onClick={() => {
                  setBulanAktif({ tahun: Number(hariIni.slice(0, 4)), bulan: Number(hariIni.slice(5, 7)) })
                  setHariPilih(hariIni)
                }}
              >
                Hari ini
              </Button>
            </div>

            <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              {NAMA_HARI_SENIN.map((hari) => <div key={hari} className="py-1">{hari}</div>)}
            </div>
            <div data-testid="anggota-kotak-bulan" className="grid grid-cols-7 gap-px overflow-hidden rounded-md bg-slate-800">
              {minggu.flat().map((sel) => {
                const isi = perTanggal.get(sel.tanggal) ?? []
                const dipilih = sel.tanggal === hariPilih
                const hari = sel.tanggal === hariIni
                return (
                  <div
                    key={sel.tanggal}
                    data-testid={`anggota-hari-${sel.tanggal}`}
                    role="button"
                    tabIndex={0}
                    aria-current={hari ? 'date' : undefined}
                    aria-label={`${formatDateLong(sel.tanggal)}${isi.length ? `, ${isi.length} sesi` : ', kosong'}`}
                    onClick={() => setHariPilih(sel.tanggal)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setHariPilih(sel.tanggal)
                      }
                    }}
                    className={cx(
                      'min-h-[3.25rem] cursor-pointer bg-slate-900 p-1 text-left sm:min-h-[5.5rem]',
                      sel.bulanIni ? '' : 'opacity-40',
                      dipilih ? 'ring-2 ring-inset ring-emerald-500' : 'hover:bg-slate-800/70',
                    )}
                  >
                    <div className={cx('mb-0.5 inline-grid h-5 min-w-5 place-items-center rounded-full px-1 text-[11px]', hari ? 'bg-emerald-500 font-bold text-slate-950' : 'text-slate-400')}>
                      {Number(sel.tanggal.slice(8))}
                    </div>
                    {/* Ringkas di HP: titik jenis kegiatan, tanpa membuat sel melebar. */}
                    <div className="flex flex-wrap gap-0.5 sm:hidden">
                      {isi.map((s) => {
                        const catatan = statusUntuk(s)
                        return (
                          <span
                            key={s.id}
                            data-testid={`anggota-titik-${s.id}`}
                            title={catatan ? STATUS_META[catatan.status]?.label : s.title}
                            className={cx('h-1.5 w-1.5 rounded-full', catatan ? warnaStatusTitik(catatan.status) : jenisTitik(s.type))}
                          />
                        )
                      })}
                    </div>
                    {/* Laptop: label lengkap + status pribadi, tanpa aksi ubah data. */}
                    <div className="hidden space-y-0.5 sm:block">
                      {isi.map((s) => {
                        const catatan = statusUntuk(s)
                        const lewatSesi = s.date < hariIni
                        return (
                          <div
                            key={s.id}
                            data-testid={`anggota-label-${s.id}`}
                            className={cx('truncate rounded border px-1 py-0.5 text-[10px] leading-tight', sesiMeta(s.type).color)}
                            title={`${s.startTime}–${s.endTime} ${s.title}`}
                          >
                            <b>{s.startTime}</b> {s.title}
                            {catatan ? (
                              <span className={cx('ml-1 font-semibold', STATUS_META[catatan.status]?.color.split(' ')[1] ?? 'text-slate-300')}>
                                {STATUS_META[catatan.status]?.short ?? catatan.status}
                              </span>
                            ) : lewatSesi && statusTerbuka ? (
                              <span className="ml-1 text-slate-400">—</span>
                            ) : null}
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
              <span><i className="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-emerald-400" />sesi</span>
              <span>H/I/S/A = status kehadiran</span>
              <span>— = belum dicatat</span>
            </div>
          </Card>

          <div data-testid="anggota-detail-hari" className="mt-4 lg:mt-0">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                {NAMA_HARI_PANJANG[hariSenin(hariPilih)]}, {formatDateLong(hariPilih).split(', ')[1]}
              </h3>
              <span className="text-[10px] text-slate-600">Baca saja</span>
            </div>
            {!pilihan.length ? (
              <EmptyState title="Tidak ada jadwal di tanggal ini." />
            ) : (
              <div className="space-y-3">
                {pilihan.map((s) => (
                  <MemberSessionCard key={s.id} session={s} attendance={statusUntuk(s)} statusTerbuka={statusTerbuka} hariIni={hariIni} />
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-5" data-testid="kalender-anggota-agenda">
          {berikutnya ? (
            <div data-testid="anggota-sesi-berikutnya">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Sesi berikutnya · <span className="text-emerald-400">{teksHitungMundur(berikutnya, new Date())}</span>
              </h3>
              <MemberSessionCard session={berikutnya} attendance={statusUntuk(berikutnya)} statusTerbuka={statusTerbuka} hariIni={hariIni} besar />
            </div>
          ) : (
            <EmptyState title="Belum ada jadwal mendatang." />
          )}

          {kelompok.map((kel) => (
            <div key={kel.awal}>
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{kel.label}</h3>
              <Card className="p-1">
                <ul className="divide-y divide-slate-800">
                  {kel.sesi.map((s) => (
                    <MemberAgendaRow
                      key={s.id}
                      session={s}
                      attendance={statusUntuk(s)}
                      statusTerbuka={statusTerbuka}
                      hariIni={hariIni}
                      open={buka === s.id}
                      onOpen={() => setBuka(buka === s.id ? null : s.id)}
                    />
                  ))}
                </ul>
              </Card>
            </div>
          ))}

          {lewat.length > 0 && (
            <div>
              <Button size="sm" variant="ghost" data-testid="anggota-lihat-lewat" onClick={() => setLihatLewat(!lihatLewat)}>
                {lihatLewat ? 'Sembunyikan' : 'Tampilkan'} yang sudah lewat ({lewat.length})
              </Button>
              {lihatLewat && kelompokLewat.map((kel) => (
                <div key={kel.awal} className="mt-3 opacity-80">
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{kel.label}</h3>
                  <Card className="p-1">
                    <ul className="divide-y divide-slate-800">
                      {[...kel.sesi].reverse().map((s) => (
                        <MemberAgendaRow
                          key={s.id}
                          session={s}
                          attendance={statusUntuk(s)}
                          statusTerbuka={statusTerbuka}
                          hariIni={hariIni}
                          open={buka === s.id}
                          onOpen={() => setBuka(buka === s.id ? null : s.id)}
                        />
                      ))}
                    </ul>
                  </Card>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/** Titik jenis kegiatan; warna status pribadi diprioritaskan di pemanggil. */
function jenisTitik(type: string): string {
  return {
    latihan: 'bg-emerald-400',
    section: 'bg-cyan-400',
    gabungan: 'bg-violet-400',
    penampilan: 'bg-amber-400',
    rapat: 'bg-sky-400',
    lainnya: 'bg-slate-400',
  }[type] ?? 'bg-slate-400'
}

function warnaStatusTitik(status: string): string {
  return {
    hadir: 'bg-emerald-400',
    izin: 'bg-sky-400',
    sakit: 'bg-amber-400',
    alpha: 'bg-rose-400',
  }[status] ?? 'bg-slate-400'
}

function MemberSessionCard({
  session,
  attendance,
  statusTerbuka,
  hariIni,
  besar,
}: {
  session: Session
  attendance?: AttendanceRecord
  statusTerbuka: boolean
  hariIni: string
  besar?: boolean
}) {
  const status = attendance ? STATUS_META[attendance.status] : null
  const lewat = session.date < hariIni
  return (
    <Card data-testid={`kartu-anggota-${session.id}`} className={cx(lewat ? 'opacity-85' : '', besar ? 'border-emerald-500/40' : '')}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={sesiMeta(session.type).color}>{sesiMeta(session.type).label}</Badge>
            <span className="text-xs text-emerald-400">{relativeDay(session.date)}</span>
            <span className="text-xs text-slate-500">{session.startTime}–{session.endTime}</span>
          </div>
          <p className={cx('mt-1.5 font-semibold text-slate-100', besar ? 'text-base' : 'text-sm')}>{session.title}</p>
          <p className="text-xs text-slate-500">
            {formatDateLong(session.date)}{session.place ? ` · ${session.place}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1">
          {status ? (
            <Badge data-testid={`kehadiran-${session.id}`} className={status.color}>{status.label}</Badge>
          ) : !statusTerbuka ? (
            <Badge data-testid={`kehadiran-${session.id}`} className="border-slate-600/40 bg-slate-700/40 text-slate-400">Terkunci</Badge>
          ) : lewat ? (
            <Badge data-testid={`kehadiran-${session.id}`} className="border-slate-600/40 bg-slate-700/40 text-slate-400">Belum dicatat</Badge>
          ) : null}
          <Button
            size="sm"
            variant="ghost"
            data-testid={`ics-anggota-${session.id}`}
            onClick={() => unduhICS(session)}
          >
            Kalender (.ics)
          </Button>
        </div>
      </div>

      {session.checklist.length > 0 && (
        <ul className="mt-3 space-y-1">
          {session.checklist.map((c) => (
            <li key={c.id} className="flex items-start gap-2 text-xs text-slate-400">
              <span className={cx('mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded border text-[10px]', c.done ? 'border-emerald-500/60 bg-emerald-500/15 text-emerald-300' : 'border-slate-600 text-slate-600')}>
                {c.done ? '✓' : ''}
              </span>
              <span className={c.done ? 'text-slate-500 line-through' : ''}>{c.text}</span>
            </li>
          ))}
        </ul>
      )}
      {session.notes && <p className="mt-3 whitespace-pre-wrap text-xs leading-relaxed text-slate-400">{session.notes}</p>}
    </Card>
  )
}

function MemberAgendaRow({
  session,
  attendance,
  statusTerbuka,
  hariIni,
  open,
  onOpen,
}: {
  session: Session
  attendance?: AttendanceRecord
  statusTerbuka: boolean
  hariIni: string
  open: boolean
  onOpen: () => void
}) {
  const status = attendance ? STATUS_META[attendance.status] : null
  return (
    <li>
      <button
        type="button"
        data-testid={`baris-anggota-${session.id}`}
        aria-expanded={open}
        onClick={onOpen}
        className="flex w-full min-w-0 items-center gap-2 rounded-md px-2 py-2 text-left hover:bg-slate-800/60"
      >
        <span className={cx('h-2 w-2 shrink-0 rounded-full', jenisTitik(session.type))} />
        <span className="w-[4.5rem] shrink-0 text-xs text-slate-400">
          {NAMA_HARI_SENIN[hariSenin(session.date)]} {Number(session.date.slice(8))}/{Number(session.date.slice(5, 7))}
        </span>
        <span className="w-12 shrink-0 text-xs text-slate-500">{session.startTime}</span>
        <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{session.title}</span>
        {status ? (
          <span className={cx('shrink-0 text-[11px] font-semibold', status.color.split(' ')[1] ?? 'text-slate-300')}>{status.short}</span>
        ) : !statusTerbuka && session.date < hariIni ? (
          <span className="shrink-0 text-[11px] text-slate-500">🔒</span>
        ) : session.date < hariIni ? (
          <span className="shrink-0 text-[11px] text-slate-500">—</span>
        ) : null}
      </button>
      {open && <div className="mb-2 mt-1"><MemberSessionCard session={session} attendance={attendance} statusTerbuka={statusTerbuka} hariIni={hariIni} /></div>}
    </li>
  )
}
