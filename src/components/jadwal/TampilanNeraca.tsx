/**
 * #35 — Neraca mingguan: menit per ranah per seksi dibandingkan target.
 *
 * Pertanyaan yang dijawab: *"minggu ini anak-anak sebenarnya latihan apa
 * saja?"* — dihitung dari **rencana**, jadi minggu depan pun bisa diperbaiki
 * sebelum lapangan. Seksi yang menganggur di blok paralel, pelatih yang
 * dijadwalkan di dua tempat, sesi tanpa rencana, dan rencana yang melebihi
 * slot ikut dilaporkan.
 */
import { useMemo, useState } from 'react'
import type { Session, TargetNeraca } from '../../db/types'
import { saveSettings } from '../../db/db'
import { Button, Card, EmptyState, Input } from '../ui'
import { IconCalendar } from '../Icons'
import { NAMA_HARI_SENIN, awalMinggu, hariSenin, labelPendek, tambahHari } from '../../lib/kalender'
import {
  LABEL_RANAH,
  PRESET_TARGET,
  RANAH_MATERI,
  WARNA_RANAH_HEX,
  jumlahTarget,
  menitKosong,
  neracaSesi,
  teksSelisih,
  type Menit,
} from '../../lib/ranahSesi'
import { todayISO } from '../../lib/utils'
import { targetMinggu } from '../../lib/programLatsar'
import { useSettings } from '../../hooks/useSettings'
import { useSeksiAktif } from '../../hooks/useSeksiAktif'
import { BilahKomposisi, LegendaRanah } from './BilahKomposisi'

function menitTarget(t: TargetNeraca): Menit {
  const m = menitKosong()
  for (const r of RANAH_MATERI) m[r] = t.persen[r] ?? 0
  return m
}

export function TampilanNeraca({
  sesi,
  awal,
  setAwal,
  onEdit,
  onPola,
  onCetakMinggu,
}: {
  sesi: Session[]
  awal: string
  setAwal: (iso: string) => void
  onEdit: (s: Session) => void
  onPola: () => void
  onCetakMinggu: (awal: string) => void
}) {
  const settings = useSettings()
  const seksi = useSeksiAktif()
  const ids = useMemo(() => seksi.map((s) => s.id), [seksi])
  const label = (id: string) => seksi.find((s) => s.id === id)?.label ?? (id === '*' ? 'Semua' : id)
  const { target, asal } = targetMinggu(settings.programLatihan, awal, settings.targetNeraca)
  const akhir = tambahHari(awal, 6)
  const dalam = useMemo(() => sesi.filter((s) => s.date >= awal && s.date <= akhir), [sesi, awal, akhir])
  const n = useMemo(() => neracaSesi(dalam, ids, { target, label }), [dalam, ids, target, seksi])
  const byId = new Map(dalam.map((s) => [s.id, s]))
  const mingguIni = awalMinggu(todayISO())

  return (
    <div className="space-y-4" data-testid="tampilan-neraca">
      <Card className="p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" data-testid="neraca-mundur" onClick={() => setAwal(tambahHari(awal, -7))} aria-label="Minggu sebelumnya">
              ‹
            </Button>
            <h2 data-testid="neraca-judul" className="min-w-[10rem] text-center text-sm font-semibold text-slate-100">
              {awal === mingguIni ? 'Minggu ini · ' : ''}
              {labelPendek(awal)} – {labelPendek(akhir)}
            </h2>
            <Button size="sm" variant="ghost" data-testid="neraca-maju" onClick={() => setAwal(tambahHari(awal, 7))} aria-label="Minggu berikutnya">
              ›
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1">
            {awal !== mingguIni && (
              <Button size="sm" variant="ghost" data-testid="neraca-hari-ini" onClick={() => setAwal(mingguIni)}>
                Minggu ini
              </Button>
            )}
            <Button size="sm" data-testid="buka-pola" onClick={onPola}>
              Pola sesi…
            </Button>
            <Button size="sm" data-testid="cetak-minggu" onClick={() => onCetakMinggu(awal)} disabled={!dalam.length}>
              Cetak rencana minggu
            </Button>
          </div>
        </div>
        <LegendaRanah className="mt-2" />
      </Card>

      {n.sesi.length === 0 ? (
        <EmptyState icon={<IconCalendar size={28} />} title="Tidak ada sesi latihan di minggu ini." />
      ) : (
        <>
          <Card className="p-3" data-testid="neraca-seksi">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Menit per ranah · {n.sesi.length} sesi
            </h3>
            <div className="space-y-2.5">
              {n.perSeksi.map((b) => (
                <div key={b.seksi} data-testid={`neraca-seksi-${b.seksi}`} className="text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium text-slate-200">{label(b.seksi)}</span>
                    <span className="text-[11px] text-slate-500">
                      materi <b className="text-slate-300">{Math.round(b.materi)}′</b>
                      {b.menit.nonmateri > 0 && <> · non-materi {Math.round(b.menit.nonmateri)}′</>}
                    </span>
                  </div>
                  <BilahKomposisi m={b.menit} className="mt-1" tinggi={10} />
                  {target && (
                    <div className="mt-0.5 flex items-center gap-1">
                      <span className="w-10 shrink-0 text-[9px] uppercase text-slate-600">target</span>
                      <BilahKomposisi m={menitTarget(target)} tinggi={4} className="opacity-70" />
                    </div>
                  )}
                  <p className="mt-0.5 text-[11px] text-slate-500">
                    {RANAH_MATERI.filter((r) => b.menit[r] > 0 || (target?.persen[r] ?? 0) > 0)
                      .map((r) => `${LABEL_RANAH[r]} ${b.persen[r]}%${target ? `/${target.persen[r] ?? 0}` : ''}`)
                      .join(' · ') || 'Belum ada menit materi.'}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-3 overflow-x-auto">
              <table data-testid="tabel-neraca" className="w-full min-w-[30rem] text-[11px]">
                <thead>
                  <tr className="text-slate-500">
                    <th className="py-1 pr-2 text-left font-medium">Seksi</th>
                    {RANAH_MATERI.map((r) => (
                      <th key={r} className="px-1 py-1 text-right font-medium">
                        <span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ background: WARNA_RANAH_HEX[r] }} />
                        {LABEL_RANAH[r]}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-slate-300">
                  {n.perSeksi.map((b) => (
                    <tr key={b.seksi} className="border-t border-slate-800">
                      <td className="py-1 pr-2">{label(b.seksi)}</td>
                      {RANAH_MATERI.map((r) => (
                        <td key={r} className="px-1 py-1 text-right tabular-nums">
                          {b.menit[r] ? `${Math.round(b.menit[r])}′` : '—'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <PanelTarget target={target} asal={asal} tim={settings.targetNeraca ?? null} />

          {(n.selisih.length > 0 || n.peringatan.length > 0) && (
            <Card className="p-3">
              {n.selisih.length > 0 && (
                <>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Meleset dari target (≥ 10 poin)</h3>
                  <ul data-testid="selisih-neraca" className="mb-2 space-y-0.5 text-xs text-amber-200">
                    {n.selisih.map((x, i) => (
                      <li key={i}>{teksSelisih(x, label, ids.length)}</li>
                    ))}
                  </ul>
                </>
              )}
              {n.peringatan.length > 0 && (
                <>
                  <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Perlu dicek</h3>
                  <ul data-testid="peringatan-neraca" className="space-y-1 text-xs">
                    {n.peringatan.map((p, i) => (
                      <li key={i} data-kode={p.kode} className="flex items-start gap-2">
                        <span className={p.tingkat === 'info' ? 'text-slate-400' : 'text-amber-300'}>
                          {p.tingkat === 'info' ? 'ℹ' : '⚠'} {NAMA_HARI_SENIN[hariSenin(p.tanggal)]} {Number(p.tanggal.slice(8))}/
                          {Number(p.tanggal.slice(5, 7))} — {p.teks}
                        </span>
                        {byId.get(p.sesiId) && (
                          <button
                            type="button"
                            className="ml-auto shrink-0 text-[11px] text-emerald-400 hover:underline"
                            onClick={() => onEdit(byId.get(p.sesiId)!)}
                          >
                            Ubah
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>
          )}

          <Card className="p-1">
            <ul className="divide-y divide-slate-800">
              {n.sesi.map((s) => (
                <li key={s.id} data-testid={`sesi-neraca-${s.id}`} className="flex items-center gap-2 px-2 py-2">
                  <span className="w-20 shrink-0 text-xs text-slate-400">
                    {NAMA_HARI_SENIN[hariSenin(s.tanggal)]} {Number(s.tanggal.slice(8))}/{Number(s.tanggal.slice(5, 7))}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-slate-200">{s.judul}</span>
                    <span className="block truncate text-[11px] text-slate-500">
                      {s.adaRencana ? s.label || '—' : 'Belum ada rencana'}
                      {s.adaParalel ? ' · ⇉ paralel' : ''}
                    </span>
                    <BilahKomposisi m={s.menit} tinggi={4} className="mt-0.5" />
                  </span>
                  <Button size="sm" variant="ghost" data-testid={`ubah-neraca-${s.id}`} onClick={() => byId.get(s.id) && onEdit(byId.get(s.id)!)}>
                    Ubah
                  </Button>
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}
    </div>
  )
}

/** Target proporsi ranah — disimpan di pengaturan tim. */
function PanelTarget({ target, asal, tim }: { target: TargetNeraca | null; asal: string | null; tim: TargetNeraca | null }) {
  const [buka, setBuka] = useState(false)
  const [draf, setDraf] = useState<TargetNeraca>(() => tim ?? { nama: 'Target sendiri', persen: {} })
  const jumlah = jumlahTarget(draf)

  async function simpan(t: TargetNeraca | null) {
    await saveSettings({ targetNeraca: t ?? undefined })
    setBuka(false)
  }

  return (
    <Card className="p-3" data-testid="target-neraca">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-slate-400">
          Target:{' '}
          {target ? (
            <b className="text-slate-200" data-testid="nama-target">
              {target.nama}
            </b>
          ) : (
            <span className="text-slate-500">belum diatur</span>
          )}
          {target && (
            <span className="ml-1 text-[11px] text-slate-500">
              ·{' '}
              {RANAH_MATERI.filter((r) => (target.persen[r] ?? 0) > 0)
                .map((r) => `${LABEL_RANAH[r]} ${target.persen[r]}%`)
                .join(' · ')}
            </span>
          )}
          {asal && (
            <span data-testid="asal-target" className="block text-[11px] text-slate-500">
              dari {asal} — ubah di Program; target tim berlaku di luar fase program
            </span>
          )}
        </p>
        <Button
          size="sm"
          variant="ghost"
          data-testid="ubah-target"
          onClick={() => {
            setDraf(tim ?? { nama: 'Target sendiri', persen: {} })
            setBuka(!buka)
          }}
        >
          {buka ? 'Tutup' : asal ? 'Atur target tim' : 'Atur target'}
        </Button>
      </div>
      {buka && (
        <div className="mt-2 space-y-2">
          <div className="flex flex-wrap gap-1">
            {PRESET_TARGET.map((p, i) => (
              <Button key={p.nama} size="sm" data-testid={`preset-target-${i}`} onClick={() => setDraf(JSON.parse(JSON.stringify(p)))}>
                {p.nama}
              </Button>
            ))}
          </div>
          <Input data-testid="target-nama" value={draf.nama} onChange={(e) => setDraf({ ...draf, nama: e.target.value })} placeholder="Nama target, mis. Fase dasar bersama" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {RANAH_MATERI.map((r) => (
              <label key={r} className="text-[11px] text-slate-400">
                <span className="mb-0.5 flex items-center gap-1">
                  <span className="inline-block h-2 w-2 rounded-sm" style={{ background: WARNA_RANAH_HEX[r] }} />
                  {LABEL_RANAH[r]} %
                </span>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  data-testid={`target-${r}`}
                  value={String(draf.persen[r] ?? 0)}
                  onChange={(e) => {
                    const v = Math.max(0, Math.min(100, Math.round(Number(e.target.value) || 0)))
                    setDraf({ ...draf, persen: { ...draf.persen, [r]: v } })
                  }}
                />
              </label>
            ))}
          </div>
          <p data-testid="jumlah-target" className={`text-[11px] ${jumlah === 100 ? 'text-emerald-400' : 'text-amber-300'}`}>
            Jumlah {jumlah}%{jumlah === 100 ? '' : ' — sebaiknya tepat 100%'}
          </p>
          <div className="flex flex-wrap justify-end gap-2">
            {tim && (
              <Button size="sm" variant="ghost" data-testid="hapus-target" onClick={() => simpan(null)}>
                Hapus target
              </Button>
            )}
            <Button size="sm" variant="primary" data-testid="simpan-target" disabled={jumlah <= 0 || !draf.nama.trim()} onClick={() => simpan({ ...draf, nama: draf.nama.trim() })}>
              Simpan target
            </Button>
          </div>
        </div>
      )}
    </Card>
  )
}
