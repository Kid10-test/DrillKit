/**
 * v2.13 — Putusan danlat untuk satu sesi: daftar izin/sakit/telat/pulang awal
 * yang menunggu putusan, pesan WA bernomor untuk danlat, tempel balasannya,
 * dan riwayat putusan (siapa, kapan, catatan).
 */
import { useMemo, useState } from 'react'
import type { AttendanceRecord, Member, Session } from '../../db/types'
import { db, saveSettings } from '../../db/db'
import { useSettings } from '../../hooks/useSettings'
import { Button, Card, Modal, useToast } from '../ui'
import type { AturanLengkap } from '../../lib/programLatsar'
import {
  LABEL_JENIS,
  bacaBalasanDanlat,
  daftarPutusan,
  labelPutusan,
  labelTerima,
  nilaiVonis,
  teksWaPutusan,
  ubahanPutusan,
  type ButirPutusan,
  type Vonis,
} from '../../lib/putusanDanlat'
import { cx, formatDateLong, sectionLabel } from '../../lib/utils'

const KUNCI_NOMOR = (sesiId: string) => `drillkit-putusan-wa-${sesiId}`

function bacaNomor(sesiId: string): string[] | null {
  try {
    const x = JSON.parse(localStorage.getItem(KUNCI_NOMOR(sesiId)) ?? 'null')
    return Array.isArray(x) && x.every((v) => typeof v === 'string') ? x : null
  } catch {
    return null
  }
}

async function salin(teks: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(teks)
  } catch {
    const t = document.createElement('textarea')
    t.value = teks
    document.body.appendChild(t)
    t.select()
    document.execCommand('copy')
    t.remove()
  }
}

const dua = (n: number) => String(n).padStart(2, '0')
const waktuPendek = (ms: number) => {
  const d = new Date(ms)
  return `${d.getDate()}/${d.getMonth() + 1} ${dua(d.getHours())}.${dua(d.getMinutes())}`
}

export default function PanelPutusan({
  session,
  aturan,
  records,
  members,
}: {
  session: Session
  aturan: AturanLengkap
  records: AttendanceRecord[]
  members: Member[]
}) {
  const toast = useToast()
  const settings = useSettings()
  const [pemutus, setPemutus] = useState<string | null>(null)
  const namaPemutus = (pemutus ?? settings.pemutusPutusan ?? 'Danlat').trim() || 'Danlat'
  const [buka, setBuka] = useState<string | null>(null)
  const [catatan, setCatatan] = useState('')
  const [balasanBuka, setBalasanBuka] = useState(false)
  const [balasan, setBalasan] = useState('')
  const [riwayatBuka, setRiwayatBuka] = useState(false)

  const perAnggota = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])
  const nama = (id: string) => perAnggota.get(id)?.name ?? '(anggota)'
  const namaWa = (id: string) => {
    const m = perAnggota.get(id)
    return m ? `${m.name}${m.section ? ` (${sectionLabel(m.section)})` : ''}` : '(anggota)'
  }
  const aktif = useMemo(() => new Set(members.filter((m) => m.active).map((m) => m.id)), [members])
  const semua = useMemo(
    () => daftarPutusan(records, session, aturan, (id) => perAnggota.get(id)?.name ?? '', aktif),
    [records, session, aturan, perAnggota, aktif],
  )
  const menunggu = semua.filter((b) => !b.putusan)
  const diputus = semua.filter((b) => b.putusan)
  const sesuai = menunggu.filter((b) => b.usul === 'terima')

  /** Nomor WA terakhir yang dikirim (id catatan) — balasan danlat dibaca dengan nomor yang sama. */
  const nomorWa = useMemo(() => {
    const ids = bacaNomor(session.id)
    if (!ids) return menunggu
    const per = new Map(semua.map((b) => [b.r.id, b]))
    return ids.map((id) => per.get(id)).filter((b): b is ButirPutusan => !!b)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.id, semua, balasanBuka])

  if (!semua.length) return null

  const simpanPemutus = () => {
    if (pemutus != null && pemutus.trim() !== (settings.pemutusPutusan ?? 'Danlat')) void saveSettings({ pemutusPutusan: pemutus.trim() || undefined })
  }

  async function putuskan(daftar: { b: ButirPutusan; v: Vonis | null; catatan?: string }[]) {
    simpanPemutus()
    const now = Date.now()
    await db.transaction('rw', db.attendance, async () => {
      for (const { b, v, catatan: c } of daftar) {
        await db.attendance.update(b.r.id, ubahanPutusan(v ? nilaiVonis(b.jenis, v) : null, namaPemutus, now, c))
      }
    })
  }

  function teksWa() {
    return teksWaPutusan(menunggu, session, aturan, {
      judulSesi: `${session.title} · ${formatDateLong(session.date)}`,
      nama: namaWa,
    })
  }

  async function salinWa() {
    localStorage.setItem(KUNCI_NOMOR(session.id), JSON.stringify(menunggu.map((b) => b.r.id)))
    await salin(teksWa())
    toast.push(`Pesan ${menunggu.length} butir disalin — tempel di WA danlat`)
  }

  function kirimWa() {
    localStorage.setItem(KUNCI_NOMOR(session.id), JSON.stringify(menunggu.map((b) => b.r.id)))
    window.open(`https://wa.me/?text=${encodeURIComponent(teksWa())}`, '_blank', 'noopener')
  }

  const hasilBalasan = balasan.trim() ? bacaBalasanDanlat(balasan, nomorWa.length) : null

  async function terapkanBalasan() {
    if (!hasilBalasan) return
    const daftar = [...hasilBalasan.vonis].map(([no, v]) => ({ b: nomorWa[no - 1], v })).filter((x) => !!x.b)
    await putuskan(daftar)
    toast.push(`${daftar.length} putusan dicatat`)
    setBalasan('')
    setBalasanBuka(false)
  }

  return (
    <Card className="mb-4" data-testid="panel-putusan">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold text-slate-100">Putusan danlat</h3>
        <span
          data-testid="putusan-menunggu"
          className={cx('rounded-full px-2 py-0.5 text-[11px] font-medium', menunggu.length ? 'bg-amber-500/20 text-amber-300' : 'bg-emerald-500/15 text-emerald-300')}
        >
          {menunggu.length ? `${menunggu.length} menunggu` : 'semua sudah diputus'}
        </span>
        {diputus.length > 0 && <span className="text-[11px] text-slate-500">{diputus.length} sudah diputus</span>}
        <label className="ml-auto flex items-center gap-1.5 text-[11px] text-slate-400">
          Pemutus
          <input
            data-testid="putusan-pemutus"
            value={pemutus ?? settings.pemutusPutusan ?? 'Danlat'}
            onChange={(e) => setPemutus(e.target.value)}
            onBlur={simpanPemutus}
            className="w-28 rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-[12px] text-slate-100 outline-none focus:border-emerald-500"
          />
        </label>
      </div>
      <p className="mt-1 text-[11px] text-slate-500">
        Selama belum diputus, hitungannya sementara mengikuti aturan. Telat/pulang awal yang disahkan tetap memakai jatah telat.
      </p>

      {menunggu.length > 0 && (
        <>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Button size="sm" variant="primary" data-testid="putusan-salin-wa" onClick={salinWa}>
              Salin pesan untuk danlat
            </Button>
            <Button size="sm" data-testid="putusan-kirim-wa" onClick={kirimWa}>
              Kirim lewat WhatsApp
            </Button>
            <Button size="sm" data-testid="putusan-tempel" onClick={() => setBalasanBuka(true)}>
              Tempel balasan danlat
            </Button>
            {sesuai.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                data-testid="putusan-terima-sesuai"
                onClick={async () => {
                  await putuskan(sesuai.map((b) => ({ b, v: 'terima' as const })))
                  toast.push(`${sesuai.length} butir yang sesuai aturan diterima`)
                }}
              >
                Terima {sesuai.length} yang sesuai aturan
              </Button>
            )}
          </div>
          <ol className="mt-2 divide-y divide-slate-800/70 rounded-lg border border-slate-800" data-testid="putusan-daftar">
            {menunggu.map((b, i) => (
              <li key={b.r.id} className="px-2.5 py-2" data-testid={`putusan-${b.r.memberId}`} data-usul={b.usul}>
                <div className="flex flex-wrap items-start gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => {
                      setBuka(buka === b.r.id ? null : b.r.id)
                      setCatatan('')
                    }}
                  >
                    <p className="text-[13px] text-slate-100">
                      <span className="mr-1 text-slate-500">{i + 1}.</span>
                      {nama(b.r.memberId)}{' '}
                      <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-300">{LABEL_JENIS[b.jenis]}</span>{' '}
                      <span className={cx('text-[10px] font-medium', b.usul === 'terima' ? 'text-emerald-400' : 'text-rose-300')}>
                        {b.usul === 'terima' ? 'sesuai aturan' : 'menurut aturan ditolak'}
                      </span>
                    </p>
                    <p className="text-[11px] text-slate-400">{b.keterangan.join(' · ')}</p>
                    {b.alasan && <p className="text-[11px] italic text-slate-400">“{b.alasan}”</p>}
                  </button>
                  <div className="flex w-full shrink-0 justify-end gap-1 sm:w-auto">
                    {b.tautanBukti && (
                      <a
                        href={b.tautanBukti}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-lg border border-slate-700 px-2 py-1 text-[11px] text-sky-300 hover:bg-slate-800"
                      >
                        Bukti
                      </a>
                    )}
                    <Button
                      size="sm"
                      data-testid={`putusan-terima-${b.r.memberId}`}
                      className="!bg-emerald-600/80 !text-white"
                      onClick={() => putuskan([{ b, v: 'terima', catatan: buka === b.r.id ? catatan : undefined }])}
                    >
                      {labelTerima(b.jenis)}
                    </Button>
                    <Button
                      size="sm"
                      variant="danger"
                      data-testid={`putusan-tolak-${b.r.memberId}`}
                      onClick={() => putuskan([{ b, v: 'tolak', catatan: buka === b.r.id ? catatan : undefined }])}
                    >
                      Ditolak
                    </Button>
                  </div>
                </div>
                {buka === b.r.id && (
                  <input
                    data-testid={`putusan-catatan-${b.r.memberId}`}
                    value={catatan}
                    onChange={(e) => setCatatan(e.target.value)}
                    placeholder="Catatan putusan (opsional), mis. bukti menyusul besok"
                    className="mt-1.5 w-full rounded-md border border-slate-700 bg-slate-950/60 px-2 py-1 text-[12px] text-slate-100 outline-none focus:border-emerald-500"
                  />
                )}
              </li>
            ))}
          </ol>
        </>
      )}

      {diputus.length > 0 && (
        <div className="mt-2">
          <button type="button" className="text-[11px] text-slate-400 underline" data-testid="putusan-riwayat-buka" onClick={() => setRiwayatBuka(!riwayatBuka)}>
            {riwayatBuka ? 'Sembunyikan' : 'Lihat'} {diputus.length} putusan
          </button>
          {riwayatBuka && (
            <ul className="mt-1 space-y-1" data-testid="putusan-riwayat">
              {diputus.map((b) => (
                <li key={b.r.id} className="flex flex-wrap items-center gap-2 text-[12px]">
                  <span className="text-slate-200">{nama(b.r.memberId)}</span>
                  <span className="text-[10px] text-slate-500">{LABEL_JENIS[b.jenis]}</span>
                  <span className={cx('font-medium', b.putusan === 'tidak-sah' ? 'text-rose-300' : 'text-emerald-300')}>{labelPutusan(b.jenis, b.putusan!)}</span>
                  <span className="text-[11px] text-slate-500">
                    {b.r.putusanOleh ?? ''}
                    {b.r.putusanAt ? ` · ${waktuPendek(b.r.putusanAt)}` : ''}
                    {b.r.putusanCatatan ? ` — ${b.r.putusanCatatan}` : ''}
                  </span>
                  <button
                    type="button"
                    data-testid={`putusan-batal-${b.r.memberId}`}
                    className="ml-auto text-[11px] text-slate-500 underline hover:text-slate-300"
                    onClick={() => putuskan([{ b, v: null }])}
                  >
                    Batalkan
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Modal open={balasanBuka} onClose={() => setBalasanBuka(false)} title="Tempel balasan danlat" testId="modal-balasan-danlat">
        <p className="text-[12px] text-slate-400">
          Nomornya mengikuti pesan terakhir yang disalin/dikirim dari sini ({nomorWa.length} butir). Contoh: “1-3 terima, 4 tolak” atau “semua terima kecuali 5”.
        </p>
        <textarea
          data-testid="balasan-teks"
          value={balasan}
          onChange={(e) => setBalasan(e.target.value)}
          rows={4}
          className="w-full rounded-lg border border-slate-700 bg-slate-950/60 px-3 py-2 text-sm text-slate-100 outline-none focus:border-emerald-500"
        />
        {hasilBalasan && (
          <div className="max-h-56 overflow-auto rounded-lg border border-slate-800 p-2 text-[12px]" data-testid="balasan-pratinjau">
            {nomorWa.map((b, i) => {
              const v = hasilBalasan.vonis.get(i + 1)
              return (
                <p key={b.r.id} className={v ? '' : 'text-slate-500'}>
                  {i + 1}. {nama(b.r.memberId)} ({LABEL_JENIS[b.jenis]}) →{' '}
                  {v ? (
                    <b className={v === 'terima' ? 'text-emerald-300' : 'text-rose-300'}>{labelPutusan(b.jenis, nilaiVonis(b.jenis, v))}</b>
                  ) : (
                    'tidak disebut'
                  )}
                </p>
              )
            })}
            {hasilBalasan.diLuar.length > 0 && <p className="text-amber-300">Nomor di luar daftar: {hasilBalasan.diLuar.join(', ')}</p>}
          </div>
        )}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setBalasanBuka(false)}>
            Batal
          </Button>
          <Button variant="primary" data-testid="balasan-terapkan" disabled={!hasilBalasan?.vonis.size} onClick={terapkanBalasan}>
            Catat {hasilBalasan?.vonis.size ?? 0} putusan
          </Button>
        </div>
      </Modal>
    </Card>
  )
}
