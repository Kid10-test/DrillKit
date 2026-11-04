/**
 * #26 (`v2.2.4`) — Panel editor "Dress, Hole & Bayangan" (*Tap ID*).
 *
 * - **Dress / guiding** per set & per bentuk `#22` → tercetak di buku saku dan
 *   tampil di HP anggota ("Luruskan ke: Tengah (A05)").
 * - **Hole**: posisi pemain dialihkan ke slot penjaga interval berlingkar
 *   putus-putus, lalu bisa diisi pemain lain kapan pun.
 * - **Bayangan / Alternate**: pemain cadangan mengikuti titik pemain inti
 *   (berbagi titik atau bergeser aman) tanpa nomor titik baru.
 */
import { useState } from 'react'
import type {
  AcuanDress,
  BayanganAnggota,
  Drill,
  DrillSet,
  DressBarisan,
  Member,
  SlotHole,
} from '../../db/types'
import {
  LABEL_ACUAN_DRESS,
  LABEL_ARAH_OFFSET,
  isiHole,
  jadikanHole,
  hapusHoleDariSet,
  keteranganBayangan,
  resolusiDress,
} from '../../lib/bukuSakuPemain'
import { uid } from '../../lib/utils'
import { Card } from '../ui'

type PatchSet = { id: string; patch: Partial<DrillSet> }

const ACUAN: AcuanDress[] = ['kiri', 'tengah', 'kanan', 'depan', 'belakang', 'anggota']

function PilihDress({
  nilai,
  calon,
  onUbah,
  testId,
}: {
  nilai?: DressBarisan
  calon: Member[]
  onUbah: (d: DressBarisan | undefined) => void
  testId: string
}) {
  return (
    <div className="flex min-w-0 flex-wrap gap-1">
      <select
        data-testid={testId}
        value={nilai?.acuan ?? ''}
        onChange={(e) => {
          const v = e.target.value as AcuanDress | ''
          if (!v) onUbah(undefined)
          else onUbah(v === 'anggota' ? { acuan: v, anggotaId: nilai?.anggotaId ?? calon[0]?.id } : { acuan: v })
        }}
        className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-1.5 py-1 text-[11px] text-slate-200"
      >
        <option value="">— tanpa dress —</option>
        {ACUAN.map((a) => (
          <option key={a} value={a}>
            {a === 'anggota' ? 'Pemandu tertentu…' : `Luruskan ke ${LABEL_ACUAN_DRESS[a].toLowerCase()}`}
          </option>
        ))}
      </select>
      {nilai?.acuan === 'anggota' && (
        <select
          data-testid={`${testId}-anggota`}
          value={nilai.anggotaId ?? ''}
          onChange={(e) => onUbah({ acuan: 'anggota', anggotaId: e.target.value })}
          className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-1.5 py-1 text-[11px] text-slate-200"
        >
          {calon.map((m) => (
            <option key={m.id} value={m.id}>
              {m.code} — {m.name}
            </option>
          ))}
        </select>
      )}
    </div>
  )
}

export function PanelTitikKhusus({
  drill,
  sets,
  idx,
  roster,
  dipilih,
  onSebelumUbah,
  onPatchSets,
  onUbahDrill,
}: {
  drill: Drill
  /** Set terurut menurut `order`. */
  sets: DrillSet[]
  idx: number
  roster: Member[]
  dipilih: string[]
  onSebelumUbah: () => void
  onPatchSets: (patches: PatchSet[]) => Promise<void>
  onUbahDrill: (patch: Partial<Pick<Drill, 'holes' | 'bayangan'>>) => Promise<void>
}) {
  const set = sets[idx]
  const [terbuka, setTerbuka] = useState(false)
  const [alasan, setAlasan] = useState<NonNullable<SlotHole['alasan']>>('kosong')
  const [indukBaru, setIndukBaru] = useState('')
  const [modeBaru, setModeBaru] = useState<BayanganAnggota['mode']>('offset')
  const [arahBaru, setArahBaru] = useState<NonNullable<BayanganAnggota['arahOffset']>>('belakang')
  const holes = drill.holes ?? []
  const bayangan = drill.bayangan ?? []
  const rosterById = new Map(roster.map((m) => [m.id, m]))
  const calonSet = set ? roster.filter((m) => set.points[m.id]) : []
  const satu = dipilih.length === 1 ? rosterById.get(dipilih[0]) : undefined
  const ringkas = [
    set?.dress ? `dress ${LABEL_ACUAN_DRESS[set.dress.acuan].toLowerCase()}` : '',
    holes.length ? `${holes.length} hole` : '',
    bayangan.length ? `${bayangan.length} bayangan` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  async function ubahDressSet(d: DressBarisan | undefined) {
    if (!set) return
    onSebelumUbah()
    await onPatchSets([{ id: set.id, patch: { dress: d } }])
  }

  async function ubahDressBentuk(idBentuk: string, d: DressBarisan | undefined) {
    if (!set?.bentukTerikat) return
    onSebelumUbah()
    await onPatchSets([
      { id: set.id, patch: { bentukTerikat: set.bentukTerikat.map((b) => (b.id === idBentuk ? { ...b, dress: d } : b)) } },
    ])
  }

  async function buatHole() {
    if (!satu) return
    const hasil = jadikanHole({
      drill,
      sets,
      memberId: satu.id,
      dariIdx: idx,
      alasan,
      idBaru: uid('hole_'),
    })
    if (!hasil) return
    onSebelumUbah()
    await onPatchSets(hasil.patchSets)
    await onUbahDrill({ holes: [...holes, hasil.hole] })
  }

  async function isi(holeId: string, memberId: string) {
    if (!memberId) return
    const hasil = isiHole({ drill, sets, holeId, memberId })
    onSebelumUbah()
    await onPatchSets(hasil.patchSets)
    await onUbahDrill({ holes: hasil.holesBaru })
  }

  async function hapusHole(holeId: string) {
    onSebelumUbah()
    const patches: PatchSet[] = []
    for (const s of sets) {
      const p = hapusHoleDariSet(s, holeId)
      if (p) patches.push({ id: s.id, patch: p })
    }
    await onPatchSets(patches)
    await onUbahDrill({ holes: holes.filter((h) => h.id !== holeId) })
  }

  async function tambahBayangan() {
    if (!satu || !indukBaru || indukBaru === satu.id) return
    const lain = bayangan.filter((b) => b.memberId !== satu.id)
    await onUbahDrill({
      bayangan: [
        ...lain,
        modeBaru === 'berbagi'
          ? { memberId: satu.id, indukId: indukBaru, mode: 'berbagi' }
          : { memberId: satu.id, indukId: indukBaru, mode: 'offset', offsetLangkah: 1, arahOffset: arahBaru },
      ],
    })
  }

  const dressSaya = satu && set ? resolusiDress(set, satu.id, roster) : null

  return (
    <Card>
      <button
        type="button"
        data-testid="toggle-panel-titik-khusus"
        onClick={() => setTerbuka((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <b className="text-xs text-slate-200">Dress, Hole &amp; Bayangan</b>
        <span className="min-w-0 flex-1 truncate text-[11px] text-slate-500">{ringkas || 'belum diatur'}</span>
        <span className="text-[11px] text-slate-500">{terbuka ? '▴' : '▾'}</span>
      </button>
      {terbuka && set && (
        <div className="mt-2.5 space-y-3" data-testid="panel-titik-khusus">
          <section className="space-y-1.5">
            <p className="text-[11px] font-semibold text-slate-300">Dress set ini</p>
            <PilihDress nilai={set.dress} calon={calonSet} onUbah={(d) => void ubahDressSet(d)} testId="dress-set" />
            {(set.bentukTerikat ?? []).map((b) => (
              <div key={b.id} className="flex min-w-0 items-center gap-1.5">
                <span className="w-20 shrink-0 truncate text-[11px] text-amber-300" title={b.nama}>
                  {b.nama}
                </span>
                <PilihDress
                  nilai={b.dress}
                  calon={b.memberIds.map((id) => rosterById.get(id)).filter((m): m is Member => Boolean(m))}
                  onUbah={(d) => void ubahDressBentuk(b.id, d)}
                  testId={`dress-bentuk-${b.id}`}
                />
              </div>
            ))}
            <p className="text-[10px] leading-snug text-slate-500">
              Kiri/kanan dari sudut pandang pemain menghadap penonton. Pemandu dipilih otomatis di dalam bentuk,
              atau di antara rekan satu seksi untuk dress set.
              {dressSaya ? (
                <>
                  {' '}
                  <b className="text-sky-300" data-testid="pratinjau-dress">
                    {satu?.code}: {dressSaya.teks}
                  </b>
                </>
              ) : null}
            </p>
          </section>

          {satu && (
            <section className="space-y-1.5 rounded-lg border border-slate-800 p-2">
              <p className="text-[11px] font-semibold text-slate-300">
                Pemain terpilih: {satu.code} — {satu.name}
              </p>
              <div className="flex flex-wrap gap-1">
                <select
                  value={alasan}
                  onChange={(e) => setAlasan(e.target.value as NonNullable<SlotHole['alasan']>)}
                  className="rounded-md border border-slate-700 bg-slate-950 px-1.5 py-1 text-[11px] text-slate-200"
                >
                  <option value="kosong">Posisi kosong</option>
                  <option value="cedera">Sedang cedera</option>
                  <option value="izin">Izin/absen</option>
                </select>
                <button
                  type="button"
                  data-testid="jadikan-hole"
                  onClick={() => void buatHole()}
                  className="rounded-md border border-slate-600 px-2 py-1 text-[11px] text-slate-100"
                  title="Mulai set ini sampai akhir, posisi pemain ini dijaga slot Hole"
                >
                  ◌ Jadikan Hole mulai set ini
                </button>
              </div>
              <div className="flex flex-wrap gap-1">
                <select
                  data-testid="pilih-induk-bayangan"
                  value={indukBaru}
                  onChange={(e) => setIndukBaru(e.target.value)}
                  className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-1.5 py-1 text-[11px] text-slate-200"
                >
                  <option value="">Jadikan bayangan dari…</option>
                  {roster
                    .filter((m) => m.id !== satu.id)
                    .map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} — {m.name}
                      </option>
                    ))}
                </select>
                <select
                  value={modeBaru === 'berbagi' ? 'berbagi' : arahBaru}
                  onChange={(e) => {
                    const v = e.target.value
                    if (v === 'berbagi') setModeBaru('berbagi')
                    else {
                      setModeBaru('offset')
                      setArahBaru(v as NonNullable<BayanganAnggota['arahOffset']>)
                    }
                  }}
                  className="rounded-md border border-slate-700 bg-slate-950 px-1.5 py-1 text-[11px] text-slate-200"
                >
                  <option value="berbagi">Berbagi titik</option>
                  {(Object.keys(LABEL_ARAH_OFFSET) as (keyof typeof LABEL_ARAH_OFFSET)[]).map((a) => (
                    <option key={a} value={a}>
                      Geser 1 lkh {LABEL_ARAH_OFFSET[a]}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  data-testid="tambah-bayangan"
                  disabled={!indukBaru}
                  onClick={() => void tambahBayangan()}
                  className="rounded-md border border-slate-600 px-2 py-1 text-[11px] text-slate-100 disabled:opacity-40"
                >
                  Simpan
                </button>
              </div>
              <p className="text-[10px] text-slate-500">
                Bayangan hanya dipakai pada set yang tidak memberi titik sendiri kepada pemain ini.
              </p>
            </section>
          )}

          <section className="space-y-1">
            <p className="text-[11px] font-semibold text-slate-300">Slot Hole ({holes.length})</p>
            {holes.length === 0 && (
              <p className="text-[10px] text-slate-500">Pilih satu pemain di kanvas, lalu “Jadikan Hole”.</p>
            )}
            {holes.map((h) => {
              const diSet = sets.filter((s) => s.points[h.id]).length
              const kosongDiSet = roster.filter((m) => !set.points[m.id])
              return (
                <div key={h.id} data-testid="baris-hole" className="flex min-w-0 flex-wrap items-center gap-1.5 text-[11px]">
                  <span className="rounded border border-dashed border-slate-400 px-1.5 font-mono text-slate-200">{h.label}</span>
                  <span className="text-slate-500">
                    {h.alasan === 'cedera' ? 'cedera' : h.alasan === 'izin' ? 'izin' : 'kosong'} · {diSet} set
                  </span>
                  <select
                    data-testid="isi-hole"
                    value=""
                    onChange={(e) => void isi(h.id, e.target.value)}
                    className="min-w-0 flex-1 rounded-md border border-slate-700 bg-slate-950 px-1.5 py-0.5 text-[11px] text-slate-200"
                  >
                    <option value="">Isi Hole dengan…</option>
                    {h.memberIdAsal && rosterById.get(h.memberIdAsal) && (
                      <option value={h.memberIdAsal}>↺ {rosterById.get(h.memberIdAsal)!.code} (pemain asal)</option>
                    )}
                    {kosongDiSet
                      .filter((m) => m.id !== h.memberIdAsal)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.code} — {m.name}
                        </option>
                      ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void hapusHole(h.id)}
                    className="px-1 text-slate-600 hover:text-rose-400"
                    title="Hapus hole beserta titiknya"
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </section>

          <section className="space-y-1">
            <p className="text-[11px] font-semibold text-slate-300">Bayangan / Alternate ({bayangan.length})</p>
            {bayangan.map((b) => (
              <div key={b.memberId} data-testid="baris-bayangan" className="flex items-center gap-1.5 text-[11px] text-slate-300">
                <span className="font-mono text-slate-100">{rosterById.get(b.memberId)?.code ?? '?'}</span>
                <span className="min-w-0 flex-1 truncate text-slate-500">{keteranganBayangan(drill, b.memberId, roster)}</span>
                <button
                  type="button"
                  onClick={() => void onUbahDrill({ bayangan: bayangan.filter((x) => x.memberId !== b.memberId) })}
                  className="px-1 text-slate-600 hover:text-rose-400"
                >
                  ✕
                </button>
              </div>
            ))}
          </section>
        </div>
      )}
    </Card>
  )
}
