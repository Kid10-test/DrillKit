/**
 * #34a — Musim TC: tanggal kejuaraan utama (H-0) & gerbang kesiapan mundur.
 *
 * Gerbang membaca bukti otomatis (partitur, Kemajuan set, simulasi juri,
 * inventaris, manifes truk); pelatih tetap bisa menandai tercapai sendiri.
 * Disimpan di `settings.musimTc` — ikut backup, tidak ikut paket anggota.
 */
import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db, saveSettings } from '../../db/db'
import type { GerbangMusim, JenisGerbangMusim, MusimTc } from '../../db/types'
import { useSettings } from '../../hooks/useSettings'
import { NAMA_BULAN, tambahHari } from '../../lib/kalender'
import {
  LABEL_JENIS_GERBANG,
  LABEL_STATUS_GERBANG,
  WARNA_STATUS_GERBANG,
  labelH,
  musimAktif,
  musimBaru,
  periksaMusim,
  teksSisa,
  type RingkasMusim,
} from '../../lib/manajemenMusim'
import { todayISO, uid } from '../../lib/utils'
import { Button, Card, ConfirmButton, Input, Select, useToast } from '../ui'
import { useRingkasMusim } from './useDataMusim'

const tgl = (iso: string) => `${Number(iso.slice(8))} ${NAMA_BULAN[Number(iso.slice(5, 7)) - 1]?.slice(0, 3) ?? ''} ${iso.slice(0, 4)}`
const JENIS: JenisGerbangMusim[] = ['musik', 'drill', 'fullrun', 'perlengkapan', 'juri', 'logistik', 'lain']

export default function PanelMusim() {
  const settings = useSettings()
  const toast = useToast()
  const daftar = settings.musimTc ?? []
  const hariIni = todayISO()
  const [pilih, setPilih] = useState('')
  const musim = daftar.find((m) => m.id === pilih) ?? musimAktif(daftar, hariIni)
  const { ringkas } = useRingkasMusim(daftar)
  const r = ringkas.find((x) => x.musim.id === musim?.id) ?? null
  const [h0Baru, setH0Baru] = useState(() => tambahHari(hariIni, 90))
  const [ubahGerbang, setUbahGerbang] = useState(false)
  const penampilan = useLiveQuery(async () => (await db.sessions.where('type').equals('penampilan').toArray()).sort((a, b) => a.date.localeCompare(b.date)), [], [])
  const drills = useLiveQuery(() => db.drills.toArray(), [], [])

  async function simpan(m: MusimTc) {
    const baru = { ...m, diubah: Date.now() }
    const ada = daftar.some((x) => x.id === m.id)
    await saveSettings({ musimTc: ada ? daftar.map((x) => (x.id === m.id ? baru : x)) : [...daftar, baru] })
  }
  async function buat() {
    if (!/^\d{4}-\d\d-\d\d$/.test(h0Baru)) return
    const sesi = penampilan.find((s) => s.date === h0Baru)
    const m = musimBaru(uid, h0Baru, sesi?.title ?? 'Kejuaraan utama')
    if (sesi) m.sessionId = sesi.id
    if (drills.length === 1) m.drillId = drills[0].id
    await simpan(m)
    setPilih(m.id)
    toast.push(`Musim dibuat: ${m.gerbang.length} gerbang mundur dari ${tgl(h0Baru)}`)
  }
  async function hapus() {
    if (!musim) return
    await saveSettings({ musimTc: daftar.filter((x) => x.id !== musim.id) })
    setPilih('')
    toast.push('Musim dihapus', 'info')
  }

  if (!musim) {
    return (
      <Card className="space-y-2 p-3" data-testid="panel-musim">
        <h2 className="text-sm font-semibold text-slate-100">Musim TC & hitung mundur H-Minus</h2>
        <p className="text-[12px] text-slate-400">
          Tetapkan tanggal kejuaraan utama (H-0). DrillKit membangkitkan gerbang kesiapan mundur — H-90 skor musik lengkap, H-60
          drill terpasang, H-30 full-run & seragam, H-14 simulasi juri Box 4+, H-3 pak truk — dan memeriksanya dari data yang sudah
          ada.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[11px] text-slate-400">
            Tanggal kejuaraan (H-0)
            <div className="w-44">
              <Input type="date" data-testid="musim-h0-baru" value={h0Baru} onChange={(e) => setH0Baru(e.target.value)} />
            </div>
          </label>
          <Button variant="primary" data-testid="musim-buat" onClick={buat} disabled={!h0Baru}>
            Buat musim
          </Button>
        </div>
      </Card>
    )
  }

  return (
    <Card className="space-y-3 p-3" data-testid="panel-musim">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-100">Musim TC & hitung mundur H-Minus</h2>
        <div className="flex flex-wrap items-center gap-1.5">
          {daftar.length > 1 && (
            <div className="w-48">
              <Select data-testid="musim-pilih" value={musim.id} onChange={(e) => setPilih(e.target.value)}>
                {daftar.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nama} · {tgl(m.tanggalH0)}
                  </option>
                ))}
              </Select>
            </div>
          )}
          <Button
            size="sm"
            data-testid="musim-tambah"
            onClick={async () => {
              const m = musimBaru(uid, tambahHari(hariIni, 90))
              await simpan(m)
              setPilih(m.id)
            }}
          >
            + Musim
          </Button>
          <ConfirmButton testId="musim-hapus" label="Hapus" message="Hapus musim ini?" onConfirm={hapus} />
        </div>
      </div>

      <DasarMusim musim={musim} simpan={simpan} penampilan={penampilan} drills={drills} />

      {r && <HitungMundurMusim r={r} />}

      {r && (
        <ul className="space-y-1.5" data-testid="daftar-gerbang">
          {r.baris.map((b) => (
            <BarisGerbang
              key={b.gerbang.id}
              b={b}
              ubah={ubahGerbang}
              onUbah={(x) => simpan({ ...musim, gerbang: musim.gerbang.map((g) => (g.id === b.gerbang.id ? { ...g, ...x } : g)) })}
              onHapus={() => simpan({ ...musim, gerbang: musim.gerbang.filter((g) => g.id !== b.gerbang.id) })}
            />
          ))}
        </ul>
      )}
      <div className="flex flex-wrap gap-1.5">
        <Button size="sm" variant={ubahGerbang ? 'primary' : 'soft'} data-testid="musim-ubah-gerbang" onClick={() => setUbahGerbang(!ubahGerbang)}>
          {ubahGerbang ? 'Selesai mengubah' : 'Ubah gerbang'}
        </Button>
        {ubahGerbang && (
          <Button
            size="sm"
            data-testid="gerbang-tambah"
            onClick={() => simpan({ ...musim, gerbang: [...musim.gerbang, { id: uid('gb_'), nama: 'Gerbang baru', hMinus: 7, jenis: 'lain' }] })}
          >
            + Gerbang
          </Button>
        )}
      </div>
      {periksaMusim(musim).length > 0 && (
        <ul className="list-disc pl-5 text-[11px] text-amber-300" data-testid="musim-masalah">
          {periksaMusim(musim).map((x) => (
            <li key={x}>{x}</li>
          ))}
        </ul>
      )}
    </Card>
  )
}

function DasarMusim({
  musim,
  simpan,
  penampilan,
  drills,
}: {
  musim: MusimTc
  simpan: (m: MusimTc) => Promise<void>
  penampilan: { id: string; date: string; title: string }[]
  drills: { id: string; name: string }[]
}) {
  const [nama, setNama] = useState(musim.nama)
  useEffect(() => setNama(musim.nama), [musim.id, musim.nama])
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
      <label className="text-[11px] text-slate-400">
        Kejuaraan
        <Input data-testid="musim-nama" value={nama} onChange={(e) => setNama(e.target.value)} onBlur={() => nama.trim() && nama !== musim.nama && simpan({ ...musim, nama: nama.trim() })} />
      </label>
      <label className="text-[11px] text-slate-400">
        Tanggal H-0
        <Input type="date" data-testid="musim-h0" value={musim.tanggalH0} onChange={(e) => e.target.value && simpan({ ...musim, tanggalH0: e.target.value })} />
      </label>
      <label className="text-[11px] text-slate-400">
        Sesi penampilan (set list)
        <Select data-testid="musim-sesi" value={musim.sessionId ?? ''} onChange={(e) => simpan({ ...musim, sessionId: e.target.value || undefined })}>
          <option value="">— semua lagu —</option>
          {penampilan.map((s) => (
            <option key={s.id} value={s.id}>
              {s.date} · {s.title}
            </option>
          ))}
        </Select>
      </label>
      <label className="text-[11px] text-slate-400">
        Drill show
        <Select data-testid="musim-drill" value={musim.drillId ?? ''} onChange={(e) => simpan({ ...musim, drillId: e.target.value || undefined })}>
          <option value="">— belum dipilih —</option>
          {drills.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
      </label>
    </div>
  )
}

function HitungMundurMusim({ r }: { r: RingkasMusim }) {
  const m = r.musim
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2">
      <div data-testid="musim-sisa" className="text-2xl font-bold tabular-nums text-slate-100">
        {labelH(r.sisaH0)}
      </div>
      <div className="min-w-0 flex-1 text-[12px] text-slate-400">
        <b className="text-slate-200">{m.nama}</b> · {tgl(m.tanggalH0)} · {teksSisa(r.sisaH0)}
      </div>
      <div className="flex flex-wrap gap-1" data-testid="musim-ringkas">
        {(['tercapai', 'terlambat', 'dekat', 'nanti'] as const).map((s) =>
          r.jumlah[s] ? (
            <span key={s} className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: WARNA_STATUS_GERBANG[s] }}>
              {r.jumlah[s]} {LABEL_STATUS_GERBANG[s].toLowerCase()}
            </span>
          ) : null,
        )}
      </div>
    </div>
  )
}

function BarisGerbang({
  b,
  ubah,
  onUbah,
  onHapus,
}: {
  b: RingkasMusim['baris'][number]
  ubah: boolean
  onUbah: (x: Partial<GerbangMusim>) => void
  onHapus: () => void
}) {
  const g = b.gerbang
  const warna = WARNA_STATUS_GERBANG[b.status]
  return (
    <li
      data-testid={`gerbang-${g.id}`}
      data-status={b.status}
      className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-1.5"
      style={{ borderLeft: `4px solid ${warna}` }}
    >
      <span className="w-12 shrink-0 font-mono text-xs font-bold text-slate-200">{labelH(g.hMinus)}</span>
      <span className="w-20 shrink-0 text-[11px] text-slate-500">{tgl(b.tanggal).replace(/ \d{4}$/, '')}</span>
      {ubah ? (
        <span className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
          <span className="w-40 min-w-0">
            <Input data-testid={`gerbang-nama-${g.id}`} value={g.nama} onChange={(e) => onUbah({ nama: e.target.value })} />
          </span>
          <span className="w-20">
            <Input type="number" min={0} data-testid={`gerbang-h-${g.id}`} value={g.hMinus} onChange={(e) => onUbah({ hMinus: Math.max(0, Math.round(Number(e.target.value) || 0)) })} title="Hari sebelum H-0" />
          </span>
          <span className="w-40">
            <Select data-testid={`gerbang-jenis-${g.id}`} value={g.jenis} onChange={(e) => onUbah({ jenis: e.target.value as JenisGerbangMusim })}>
              {JENIS.map((j) => (
                <option key={j} value={j}>
                  {LABEL_JENIS_GERBANG[j]}
                </option>
              ))}
            </Select>
          </span>
          <Button size="sm" variant="ghost" data-testid={`gerbang-hapus-${g.id}`} onClick={onHapus}>
            ✕
          </Button>
        </span>
      ) : (
        <span className="min-w-0 flex-1">
          <span className="block text-sm text-slate-100">{g.nama}</span>
          <span className="block text-[11px] text-slate-500" data-testid={`gerbang-bukti-${g.id}`}>
            {b.bukti.teks}
            {b.manual ? ' · ditandai pelatih' : ''}
          </span>
        </span>
      )}
      <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: warna }}>
        {LABEL_STATUS_GERBANG[b.status]}
        {b.status !== 'tercapai' ? ` · ${teksSisa(b.sisa)}` : ''}
      </span>
      {b.bukti.ok !== true && (
        <label className="flex items-center gap-1 text-[11px] text-slate-400" title="Tandai tercapai secara manual">
          <input type="checkbox" data-testid={`gerbang-cek-${g.id}`} checked={!!g.tercapaiAt} onChange={(e) => onUbah({ tercapaiAt: e.target.checked ? Date.now() : undefined })} />
          tercapai
        </label>
      )}
    </li>
  )
}
