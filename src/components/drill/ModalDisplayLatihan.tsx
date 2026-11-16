/**
 * v2.12 — Display Latihan.
 *
 * Penyusun drill latihan pendek dari tujuh konsep berjenjang. Pelatih memilih
 * konsep, lapangan hari itu (lapangan sepak bola atau Student Center/indoor),
 * dan siapa yang hadir; DrillKit menyusun set-setnya untuk jumlah orang itu.
 * Hasilnya drill biasa: bisa disunting, diputar, dicetak, dan dibagikan.
 */
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { Drill, DrillSet, FieldConfig, Member } from '../../db/types'
import { Button, Input, Modal, Select, useToast } from '../ui'
import { FIELD_PRESETS, M_TO_YD, fieldBox } from '../../lib/field'
import {
  KONSEP_DISPLAY,
  LABEL_MOMEN,
  konsepById,
  peranDisplay,
  susunDisplay,
  teksCountSheet,
  type HasilPenyusun,
  type PemainDisplay,
  type PeranDisplay,
} from '../../lib/penyusunDisplay'
import { sectionLabel, uid } from '../../lib/utils'

type JenisLapangan = 'sepakbola' | 'indoor'
type SumberPemain = 'sesi' | 'aktif'

const LABEL_PERAN: Record<PeranDisplay, string> = {
  brass: 'Brass',
  perkusi: 'Perkusi',
  guard: 'Guard',
  pit: 'Pit',
  pemimpin: 'Pemimpin',
  lain: 'Lainnya',
}
const WARNA_PERAN: Record<PeranDisplay, string> = {
  brass: '#f59e0b',
  perkusi: '#38bdf8',
  guard: '#f472b6',
  pit: '#a78bfa',
  pemimpin: '#f8fafc',
  lain: '#94a3b8',
}

/** Ubah anggota menjadi pemain penyusun; instrumen dipakai bila section tidak jelas. */
export function keDisplay(m: Member): PemainDisplay {
  const label = sectionLabel(m.section)
  const dasar = { section: m.section, labelSection: label, role: m.role }
  const labelSection = peranDisplay(dasar) === 'lain' && m.instrument ? `${label} ${m.instrument}` : label
  return { id: m.id, section: m.section, labelSection, role: m.role, code: m.code }
}

function lapanganUntuk(jenis: JenisLapangan, dasar: FieldConfig, panjangM: number, lebarM: number): FieldConfig {
  const preset = FIELD_PRESETS.find((p) => p.id === jenis)
  const f: FieldConfig = {
    ...dasar,
    showLabels: 1,
    gridTampil: 1,
    subgridTampil: 0,
    warna: 'hijau',
    parade: undefined,
    hashTampil: 0,
    ...(preset?.config ?? {}),
  }
  if (jenis === 'indoor') {
    f.lengthYd = Math.max(10, panjangM) * M_TO_YD
    f.widthYd = Math.max(8, lebarM) * M_TO_YD
  }
  return f
}

interface Bingkai {
  x: number
  y: number
  w: number
  h: number
}

/**
 * Bingkai pratinjau: dipotong ke daerah yang dipakai di semua set (ditambah
 * 6 langkah), tetapi tidak keluar dari lapangan. Di lapangan sepak bola
 * formasi 60 orang hanya sepertiga lebar; tanpa dipotong, dotnya tak terbaca.
 */
function bingkaiPratinjau(hasil: HasilPenyusun, field: FieldConfig): Bingkai {
  const b = fieldBox(field)
  const semua = hasil.sets.flatMap((s) => Object.values(s.points))
  if (!semua.length) return { x: 0, y: 0, w: b.totalLengthYd, h: b.totalWidthYd }
  const tepi = 6 * (5 / 8)
  // Koordinat SVG: x = maxX − x (Side 1 di kiri), y = maxY − y (penonton di bawah).
  const xs = semua.map((p) => b.maxX - p.x)
  const ys = semua.map((p) => b.maxY - p.y)
  let x0 = Math.max(0, Math.min(...xs) - tepi)
  let x1 = Math.min(b.totalLengthYd, Math.max(...xs) + tepi)
  const y0 = Math.max(0, Math.min(...ys) - tepi)
  // Tepi depan lapangan selalu terlihat sebagai patokan arah penonton.
  const y1 = b.totalWidthYd
  // Jaga perbandingan paling sempit 3 : 2 supaya empat pratinjau sejajar.
  const h = y1 - y0
  if (x1 - x0 < h * 1.5) {
    const tengah = (x0 + x1) / 2
    x0 = Math.max(0, tengah - h * 0.75)
    x1 = Math.min(b.totalLengthYd, tengah + h * 0.75)
  }
  return { x: x0, y: y0, w: x1 - x0, h }
}

/** Pratinjau kecil satu set; penonton di bawah, Side 1 di kiri (sama dengan editor). */
function MiniSet({
  hasil,
  indeks,
  field,
  peranId,
  bingkai,
}: {
  hasil: HasilPenyusun
  indeks: number
  field: FieldConfig
  peranId: Record<string, PeranDisplay>
  bingkai: Bingkai
}) {
  const set = hasil.sets[indeks]
  const b = fieldBox(field)
  const r = Math.max(0.35, Math.min(bingkai.w, bingkai.h) / 60)
  return (
    <figure className="min-w-0">
      <svg
        viewBox={`${bingkai.x} ${bingkai.y} ${bingkai.w} ${bingkai.h}`}
        className="w-full rounded border border-slate-700 bg-emerald-950/60"
        role="img"
        aria-label={set.nama}
      >
        <line x1={b.maxX} y1={bingkai.y} x2={b.maxX} y2={bingkai.y + bingkai.h} stroke="#334155" strokeWidth={r * 0.4} />
        <line x1={0} y1={b.totalWidthYd} x2={b.totalLengthYd} y2={b.totalWidthYd} stroke="#64748b" strokeWidth={r * 0.8} />
        {Object.entries(set.points).map(([id, p]) => (
          <circle key={id} cx={b.maxX - p.x} cy={b.maxY - p.y} r={r} fill={WARNA_PERAN[peranId[id] ?? 'lain']} />
        ))}
      </svg>
      <figcaption className="mt-1 truncate text-[11px] text-slate-400">
        {indeks + 1}. {LABEL_MOMEN[set.momen]}
      </figcaption>
    </figure>
  )
}

export function ModalDisplayLatihan({
  open,
  onClose,
  members,
  fieldDasar,
  onDibuat,
}: {
  open: boolean
  onClose: () => void
  members: Member[]
  fieldDasar: FieldConfig
  onDibuat: (drillId: string) => void
}) {
  const toast = useToast()
  const [konsep, setKonsep] = useState(1)
  const [jenis, setJenis] = useState<JenisLapangan>('sepakbola')
  const [panjangM, setPanjangM] = useState(40)
  const [lebarM, setLebarM] = useState(20)
  const [sumberPilihan, setSumber] = useState<SumberPemain>('sesi')
  const [sesiId, setSesiId] = useState('')
  const [dikecualikan, setDikecualikan] = useState<Set<string>>(new Set())
  const [menyimpan, setMenyimpan] = useState(false)

  const sesiHadir = useLiveQuery(
    async () => {
      if (!open) return undefined
      const [sesi, absen] = await Promise.all([db.sessions.toArray(), db.attendance.toArray()])
      const hitung = new Map<string, string[]>()
      for (const a of absen) {
        if (a.status !== 'hadir') continue
        const daftar = hitung.get(a.sessionId) ?? []
        daftar.push(a.memberId)
        hitung.set(a.sessionId, daftar)
      }
      return sesi
        .filter((s) => hitung.has(s.id))
        .sort((a, b) => b.date.localeCompare(a.date) || b.startTime.localeCompare(a.startTime))
        .slice(0, 30)
        .map((s) => ({ id: s.id, label: `${s.date} · ${s.title}`, hadir: hitung.get(s.id) ?? [] }))
    },
    [open],
  )

  // Tanpa data kehadiran sama sekali, pakai anggota aktif. `sesiHadir` masih
  // undefined selama kueri berjalan — itu bukan berarti kosong.
  const sumber: SumberPemain = sesiHadir && sesiHadir.length === 0 ? 'aktif' : sumberPilihan

  // Sesi terbaru dipilih otomatis.
  useEffect(() => {
    if (!open || !sesiHadir?.length) return
    if (!sesiId || !sesiHadir.some((s) => s.id === sesiId)) setSesiId(sesiHadir[0].id)
  }, [open, sesiHadir, sesiId])

  const kandidat = useMemo(() => {
    if (sumber === 'aktif') return members.filter((m) => m.active)
    const hadir = new Set(sesiHadir?.find((s) => s.id === sesiId)?.hadir ?? [])
    return members.filter((m) => hadir.has(m.id))
  }, [sumber, sesiId, sesiHadir, members])

  const pemain = useMemo(() => kandidat.filter((m) => !dikecualikan.has(m.id)).map(keDisplay), [kandidat, dikecualikan])
  const peranId = useMemo(() => Object.fromEntries(pemain.map((p) => [p.id, peranDisplay(p)])), [pemain])
  const field = useMemo(() => lapanganUntuk(jenis, fieldDasar, panjangM, lebarM), [jenis, fieldDasar, panjangM, lebarM])
  const hasil = useMemo(() => (open ? susunDisplay(pemain, { konsep, field }) : null), [open, pemain, konsep, field])
  const k = konsepById(konsep)
  const bingkai = useMemo(() => (hasil ? bingkaiPratinjau(hasil, field) : null), [hasil, field])

  async function buat() {
    if (!hasil || !hasil.sets.length) return
    setMenyimpan(true)
    try {
      const sekarang = Date.now()
      const lapangan = jenis === 'sepakbola' ? 'lapangan sepak bola' : `indoor ${panjangM} × ${lebarM} m`
      const d: Drill = {
        id: uid('d_'),
        name: `Display Latihan ${k.id} — ${k.judul}`,
        showTitle: `Display Latihan · ${pemain.length} orang · ${lapangan}`,
        field,
        tempo: 112,
        beatsPerCount: 1,
        rosterIds: pemain.map((p) => p.id),
        createdAt: sekarang,
        updatedAt: sekarang,
      }
      const countSheet = teksCountSheet(hasil)
      const sets: DrillSet[] = hasil.sets.map((s, i) => ({
        id: uid('set_'),
        drillId: d.id,
        order: i,
        name: s.nama,
        counts: i === hasil.sets.length - 1 ? 0 : s.counts,
        points: s.points,
        notes: [s.catatan, i === 0 ? `\n${countSheet}\n\n${k.alat}` : ''].join('').trim(),
        createdAt: sekarang + i,
      }))
      await db.transaction('rw', db.drills, db.sets, async () => {
        await db.drills.put(d)
        await db.sets.bulkPut(sets)
      })
      toast.push(`Display Latihan ${k.id} dibuat untuk ${pemain.length} orang`)
      onDibuat(d.id)
      onClose()
    } finally {
      setMenyimpan(false)
    }
  }

  const jumlahPeran = hasil
    ? (Object.entries(hasil.jumlah) as [PeranDisplay, number][]).filter(([, n]) => n > 0)
    : []

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Display Latihan"
      wide
      testId="modal-display-latihan"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button variant="primary" data-testid="buat-display" disabled={!hasil?.sets.length || menyimpan} onClick={buat}>
            Buat drill
          </Button>
        </>
      }
    >
      <p className="text-xs leading-relaxed text-slate-400">
        Pilih konsep, lapangan, dan siapa yang hadir. Set disusun ulang untuk jumlah orang hari ini, dengan dot di
        langkah bulat dari patok A dan T0. Hasilnya drill biasa yang masih bisa disunting.
      </p>

      <section>
        <h4 className="mb-1.5 text-xs font-medium text-slate-300">1. Konsep</h4>
        <div className="grid gap-1.5 sm:grid-cols-2">
          {KONSEP_DISPLAY.map((kd) => (
            <button
              key={kd.id}
              type="button"
              data-testid={`konsep-display-${kd.id}`}
              aria-pressed={konsep === kd.id}
              onClick={() => setKonsep(kd.id)}
              className={`rounded-lg border px-3 py-2 text-left transition ${
                konsep === kd.id ? 'border-orange-400 bg-orange-500/10' : 'border-slate-700 hover:border-slate-500'
              }`}
            >
              <div className="text-[13px] font-semibold text-slate-100">
                {kd.id}. {kd.judul}
              </div>
              <div className="mt-0.5 text-[11px] leading-snug text-slate-400">{kd.ringkas}</div>
            </button>
          ))}
        </div>
        <div className="mt-2 rounded-lg bg-slate-950/50 p-2.5 text-[11px] leading-relaxed text-slate-400">
          <b className="text-slate-300">Kapan:</b> {k.kapan}. <b className="text-slate-300">Teknik:</b> {k.teknik.join(', ')}.{' '}
          <b className="text-slate-300">Alat:</b> {k.alat}
        </div>
      </section>

      <section>
        <h4 className="mb-1.5 text-xs font-medium text-slate-300">2. Lapangan</h4>
        <div className="flex flex-wrap items-end gap-2">
          <Button size="sm" data-testid="display-lapangan-sepakbola" variant={jenis === 'sepakbola' ? 'primary' : 'soft'} onClick={() => setJenis('sepakbola')}>
            Sepak bola 105 × 68 m
          </Button>
          <Button size="sm" data-testid="display-lapangan-indoor" variant={jenis === 'indoor' ? 'primary' : 'soft'} onClick={() => setJenis('indoor')}>
            Student Center / indoor
          </Button>
          {jenis === 'indoor' && (
            <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
              <Input
                type="number"
                min={10}
                max={120}
                value={panjangM}
                data-testid="display-panjang"
                onChange={(e) => setPanjangM(Number(e.target.value) || 0)}
                className="w-16"
                aria-label="Panjang (m)"
              />
              ×
              <Input
                type="number"
                min={8}
                max={80}
                value={lebarM}
                data-testid="display-lebar"
                onChange={(e) => setLebarM(Number(e.target.value) || 0)}
                className="w-16"
                aria-label="Lebar (m)"
              />
              m
            </div>
          )}
        </div>
        {jenis === 'indoor' && (
            <p className="mt-1 text-[11px] text-slate-500">Ukur ruangan yang benar-benar bisa dipakai (tanpa tribun dan jalur keluar).</p>
        )}
      </section>

      <section>
        <h4 className="mb-1.5 text-xs font-medium text-slate-300">3. Pemain</h4>
        <div className="flex flex-wrap items-center gap-2">
          <Select value={sumber} onChange={(e) => setSumber(e.target.value as SumberPemain)} className="w-44" data-testid="display-sumber">
            <option value="sesi" disabled={!sesiHadir?.length}>
              Hadir di sesi
            </option>
            <option value="aktif">Semua anggota aktif</option>
          </Select>
          {sumber === 'sesi' && !!sesiHadir?.length && (
            <Select value={sesiId} onChange={(e) => setSesiId(e.target.value)} className="min-w-0 flex-1" data-testid="display-sesi">
              {sesiHadir.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label} ({s.hadir.length} hadir)
                </option>
              ))}
            </Select>
          )}
        </div>
        <details className="mt-2 rounded-lg border border-slate-800 p-2">
          <summary className="cursor-pointer text-[11px] text-slate-400">
            {pemain.length} orang ikut
            {jumlahPeran.length > 0 && ': ' + jumlahPeran.map(([p, n]) => `${LABEL_PERAN[p]} ${n}`).join(' · ')}
            {dikecualikan.size > 0 && ` · ${dikecualikan.size} dikeluarkan`}
          </summary>
          <div className="mt-2 grid max-h-48 grid-cols-2 gap-x-3 gap-y-1 overflow-y-auto sm:grid-cols-3">
            {kandidat.map((m) => (
              <label key={m.id} className="flex items-center gap-1.5 text-[11px] text-slate-300">
                <input
                  type="checkbox"
                  checked={!dikecualikan.has(m.id)}
                  onChange={(e) => {
                    const baru = new Set(dikecualikan)
                    if (e.target.checked) baru.delete(m.id)
                    else baru.add(m.id)
                    setDikecualikan(baru)
                  }}
                />
                <span className="truncate">
                  {m.code} · {sectionLabel(m.section)}
                </span>
              </label>
            ))}
          </div>
        </details>
      </section>

      {hasil && hasil.sets.length > 0 && (
        <section data-testid="pratinjau-display">
          <h4 className="mb-1.5 text-xs font-medium text-slate-300">4. Pratinjau</h4>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {hasil.sets.map((_, i) => (
              <MiniSet key={i} hasil={hasil} indeks={i} field={field} peranId={peranId} bingkai={bingkai!} />
            ))}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
            {jumlahPeran.map(([p]) => (
              <span key={p} className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full" style={{ background: WARNA_PERAN[p] }} /> {LABEL_PERAN[p]}
              </span>
            ))}
          </div>
          <table className="mt-2 w-full text-[11px] text-slate-300">
            <thead className="text-left text-slate-500">
              <tr>
                <th className="py-1 font-normal">Transisi</th>
                <th className="py-1 font-normal">Hitungan</th>
                <th className="py-1 font-normal">Langkah terbesar</th>
                <th className="py-1 font-normal">Fokus</th>
              </tr>
            </thead>
            <tbody>
              {hasil.transisi.map((t, i) => (
                <tr key={i} className="border-t border-slate-800 align-top" data-testid="baris-transisi-display">
                  <td className="py-1 pr-2">
                    {i + 1} → {i + 2}
                  </td>
                  <td className="py-1 pr-2">{t.counts}</td>
                  <td className="py-1 pr-2">{t.ukuranTo5 ? `${t.ukuranTo5} to 5` : 'di tempat'}</td>
                  <td className="py-1">{t.fokus}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1 text-[11px] text-slate-500">
            Interval musik {hasil.interval.musik} langkah · guard {hasil.interval.guard} · blok {hasil.interval.blok}.
          </p>
        </section>
      )}

      {hasil && hasil.peringatan.length > 0 && (
        <ul data-testid="peringatan-display" className="space-y-1 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-[11px] leading-relaxed text-amber-200">
          {hasil.peringatan.map((p, i) => (
            <li key={i}>{p}</li>
          ))}
        </ul>
      )}
    </Modal>
  )
}
