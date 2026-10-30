/**
 * A7 — Penanda bebas di lapangan.
 *
 * Kadang formasi butuh tanda yang **bukan pemain**: properti (podium, drum
 * besar), bendera sudut, garis bantu untuk latihan, atau sekadar label area.
 * Penanda disimpan **per drill** (`Drill.markers`), jadi tampil di semua set —
 * sama seperti garis lapangan — dan ikut ke mode presenter, ekspor SVG, serta
 * dot sheet yang dicetak.
 *
 * Warna selalu hex murni (bukan `oklch()`/`lab()`) supaya tetap aman di
 * browser lama pada berkas portabel.
 */
import type { Drill, FieldMarker, MarkerKind, Member, PosisiPenandaSet } from '../db/types'
import { Button, Card, ConfirmButton, Field, Input, Modal, Select, useToast } from './ui'
import { apakahPropertiBergerak, ringkasKruProperti } from '../lib/propertiGerak'
import { esc } from '../lib/print'
import { uid } from '../lib/utils'

/** Palet warna penanda — hex murni, kontras di atas lapangan hijau/gelap. */
export const WARNA_PENANDA = [
  '#fbbf24', // kuning
  '#f87171', // merah
  '#4ade80', // hijau
  '#38bdf8', // biru
  '#c084fc', // ungu
  '#f472b6', // merah muda
  '#e2e8f0', // putih
  '#a3e635', // limau
]

export const JENIS_PENANDA: { id: MarkerKind; label: string; butuhDua: boolean; ikon: string }[] = [
  { id: 'titik', label: 'Titik / properti', butuhDua: false, ikon: '●' },
  { id: 'kotak', label: 'Kotak / area', butuhDua: true, ikon: '▭' },
  { id: 'garis', label: 'Garis bantu', butuhDua: true, ikon: '╱' },
  { id: 'panah', label: 'Panah arah', butuhDua: true, ikon: '→' },
  { id: 'teks', label: 'Teks / label', butuhDua: false, ikon: 'T' },
]

export function infoJenis(j: MarkerKind) {
  return JENIS_PENANDA.find((x) => x.id === j) ?? JENIS_PENANDA[0]
}

export function butuhDuaTitik(j: MarkerKind) {
  return infoJenis(j).butuhDua
}

export function penandaBaru(jenis: MarkerKind = 'titik'): FieldMarker {
  return { id: uid('mk_'), jenis, label: '', x: 0, y: 0, warna: WARNA_PENANDA[0] }
}

/* --------------------------- Gambar di lapangan --------------------------- */

/**
 * Lapisan SVG penanda. Dipakai editor, mode presenter, dan ekspor SVG.
 * Satu-satunya yang perlu diketahui pemanggil hanyalah fungsi konversi
 * yard → satuan SVG (`sx`/`sy`) yang sudah dipakai titik pemain.
 */
export function MarkerLayer({
  markers,
  sx,
  sy,
  redup = false,
}: {
  markers: FieldMarker[]
  sx: (v: number) => number
  sy: (v: number) => number
  /** agak transparan — dipakai mode presenter supaya pemain tetap menonjol */
  redup?: boolean
}) {
  if (!markers.length) return null
  return (
    <g data-testid="lapisan-penanda" style={{ pointerEvents: 'none' }} opacity={redup ? 0.75 : 1}>
      {markers.map((m) => {
        const w = m.warna
        const x = sx(m.x)
        const y = sy(m.y)
        const dua = butuhDuaTitik(m.jenis)
        const x2 = dua ? sx(m.x2 ?? m.x) : x
        const y2 = dua ? sy(m.y2 ?? m.y) : y

        const rot = m.rotasi ?? 0
        const cxRot = dua ? (x + x2) / 2 : x
        const cyRot = dua ? (y + y2) / 2 : y
        const tfRot = rot ? `rotate(${rot.toFixed(2)}, ${cxRot.toFixed(3)}, ${cyRot.toFixed(3)})` : undefined

        if (m.jenis === 'kotak') {
          return (
            <g key={m.id} data-penanda={m.jenis} transform={tfRot}>
              <rect
                x={Math.min(x, x2)}
                y={Math.min(y, y2)}
                width={Math.abs(x2 - x)}
                height={Math.abs(y2 - y)}
                fill={w}
                fillOpacity={0.12}
                stroke={w}
                strokeWidth={0.25}
                strokeDasharray="1 0.6"
              />
              {m.label && (
                <text x={Math.min(x, x2)} y={Math.min(y, y2) - 1} fontSize={1.7} fill={w}>
                  {m.label}
                </text>
              )}
            </g>
          )
        }

        if (m.jenis === 'garis') {
          return (
            <g key={m.id} data-penanda={m.jenis} transform={tfRot}>
              <line x1={x} y1={y} x2={x2} y2={y2} stroke={w} strokeWidth={0.3} strokeDasharray="1.4 0.9" />
              {m.label && (
                <text x={(x + x2) / 2} y={(y + y2) / 2 - 0.8} fontSize={1.7} fill={w} textAnchor="middle">
                  {m.label}
                </text>
              )}
            </g>
          )
        }

        if (m.jenis === 'panah') {
          // Ujung panah dihitung sendiri (tanpa <marker>) supaya tidak
          // bentrok dengan id penanda milik jejak gerak (A5).
          const a = Math.atan2(y2 - y, x2 - x)
          const s = 2.2
          const p1 = [x2 - s * Math.cos(a - 0.42), y2 - s * Math.sin(a - 0.42)]
          const p2 = [x2 - s * Math.cos(a + 0.42), y2 - s * Math.sin(a + 0.42)]
          return (
            <g key={m.id} data-penanda={m.jenis} transform={tfRot}>
              <line x1={x} y1={y} x2={x2} y2={y2} stroke={w} strokeWidth={0.35} />
              <polygon points={`${x2},${y2} ${p1[0]},${p1[1]} ${p2[0]},${p2[1]}`} fill={w} />
              {m.label && (
                <text x={(x + x2) / 2} y={(y + y2) / 2 - 0.8} fontSize={1.7} fill={w} textAnchor="middle">
                  {m.label}
                </text>
              )}
            </g>
          )
        }

        if (m.jenis === 'teks') {
          return (
            <text
              key={m.id}
              data-penanda={m.jenis}
              transform={tfRot}
              x={x}
              y={y}
              fontSize={2.6}
              fill={w}
              textAnchor="middle"
              fontWeight={600}
            >
              {m.label || 'Teks'}
            </text>
          )
        }

        // titik / properti
        const rad = m.r && m.r > 0 ? m.r : 1.6
        return (
          <g key={m.id} data-penanda={m.jenis} transform={tfRot}>
            <circle
              cx={x}
              cy={y}
              r={rad}
              fill={w}
              fillOpacity={0.2}
              stroke={w}
              strokeWidth={0.3}
            />
            {rot !== 0 && (
              <line x1={x} y1={y} x2={x} y2={y + rad} stroke={w} strokeWidth={0.35} />
            )}
            {m.label && (
              <text x={x} y={y - rad - 0.8} fontSize={1.7} fill={w} textAnchor="middle">
                {m.label}
              </text>
            )}
          </g>
        )
      })}
    </g>
  )
}

/* --------------------------------- Panel ---------------------------------- */

/**
 * Kartu di panel samping: daftar penanda + tombol tambah/ubah/hapus.
 * Panel ini dikendalikan dari luar (`edit`, `petik`) karena koordinat bisa
 * dipetik langsung dari lapangan — dan yang pegang klik lapangan adalah
 * halaman editor (`Drill.tsx`).
 */
export function PenandaPanel({
  markers,
  sYd,
  edit,
  setEdit,
  petik,
  setPetik,
  onSimpan,
  setAktif,
  roster = [],
}: {
  markers: FieldMarker[]
  /** yard per langkah — untuk menampilkan koordinat dalam langkah */
  sYd: number
  edit: { draf: FieldMarker; baru: boolean } | null
  setEdit: (v: { draf: FieldMarker; baru: boolean } | null) => void
  petik: { draf: FieldMarker; tahap: 1 | 2 } | null
  setPetik: (v: { draf: FieldMarker; tahap: 1 | 2 } | null) => void
  onSimpan: (daftar: FieldMarker[]) => void
  /** #16.4 — set yang sedang aktif di editor (untuk keyframe properti bergerak) */
  setAktif?: { id: string; name: string }
  /** #16.4 — daftar anggota drill untuk penunjukan kru dorong properti */
  roster?: Member[]
}) {
  const toast = useToast()
  const draf = edit?.draf
  const dua = draf ? butuhDuaTitik(draf.jenis) : false
  const rosterById = new Map(roster.map((m) => [m.id, m]))
  const kfSetAktif: PosisiPenandaSet | undefined =
    draf && setAktif ? draf.perSet?.[setAktif.id] : undefined

  function buka(jenis: MarkerKind = 'titik') {
    setEdit({ draf: penandaBaru(jenis), baru: true })
  }

  function ubah(patch: Partial<FieldMarker>) {
    if (!draf) return
    setEdit({ draf: { ...draf, ...patch }, baru: !!edit?.baru })
  }

  function jugKeyframeSetAktif(nyala: boolean) {
    if (!draf || !setAktif) return
    const salin = { ...(draf.perSet ?? {}) }
    if (nyala) {
      salin[setAktif.id] = {
        x: draf.x,
        y: draf.y,
        ...(dua ? { x2: draf.x2 ?? draf.x, y2: draf.y2 ?? draf.y } : {}),
        rotasi: draf.rotasi ?? 0,
      }
    } else {
      delete salin[setAktif.id]
    }
    ubah({ perSet: Object.keys(salin).length ? salin : undefined })
  }

  function ubahKeyframeSetAktif(patch: Partial<PosisiPenandaSet>) {
    if (!draf || !setAktif) return
    const lama: PosisiPenandaSet = draf.perSet?.[setAktif.id] ?? {
      x: draf.x,
      y: draf.y,
      x2: draf.x2,
      y2: draf.y2,
      rotasi: draf.rotasi ?? 0,
    }
    ubah({
      perSet: {
        ...(draf.perSet ?? {}),
        [setAktif.id]: { ...lama, ...patch },
      },
    })
  }

  function jugKru(memberId: string) {
    if (!draf) return
    const s = new Set(draf.kruIds ?? [])
    if (s.has(memberId)) s.delete(memberId)
    else s.add(memberId)
    ubah({ kruIds: s.size ? [...s] : undefined })
  }

  function simpan() {
    if (!draf) return
    const label = draf.label.trim() || infoJenis(draf.jenis).label
    const bersih: FieldMarker = { ...draf, label }
    if (!butuhDuaTitik(bersih.jenis)) {
      delete bersih.x2
      delete bersih.y2
    }
    const ada = markers.some((m) => m.id === bersih.id)
    onSimpan(ada ? markers.map((m) => (m.id === bersih.id ? bersih : m)) : [...markers, bersih])
    setEdit(null)
    toast.push(ada ? 'Penanda diperbarui' : 'Penanda ditambahkan')
  }

  function hapus(id: string) {
    onSimpan(markers.filter((m) => m.id !== id))
    toast.push('Penanda dihapus', 'info')
  }

  const langkah = (v: number) => `${Math.round((v / sYd) * 4) / 4}`

  return (
    <Card>
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">
          Penanda lapangan <span className="text-slate-500">({markers.length})</span>
        </h2>
        <Button size="sm" onClick={() => buka('titik')} data-testid="tambah-penanda">
          + Penanda
        </Button>
      </div>

      {markers.length === 0 ? (
        <p className="text-[11px] leading-relaxed text-slate-500">
          Tambahkan properti, bendera, garis bantu, atau label area. Penanda tampil di semua set,
          ikut ke mode presenter dan dot sheet yang dicetak.
        </p>
      ) : (
        <ul className="space-y-1.5" data-testid="daftar-penanda">
          {markers.map((m) => (
            <li
              key={m.id}
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/40 px-2 py-1.5"
            >
              <span className="w-4 shrink-0 text-center text-sm" style={{ color: m.warna }}>
                {infoJenis(m.jenis).ikon}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-1.5 truncate text-xs text-slate-200">
                  <span className="truncate">{m.label}</span>
                  {apakahPropertiBergerak(m) && (
                    <span
                      data-testid="lencana-properti-bergerak"
                      className="shrink-0 rounded border border-amber-500/40 bg-amber-500/15 px-1 py-0 text-[9px] font-semibold text-amber-200"
                    >
                      Bergerak
                    </span>
                  )}
                </p>
                <p className="truncate text-[10px] text-slate-500">
                  {infoJenis(m.jenis).label} · {langkah(m.x)}, {langkah(m.y)}
                  {butuhDuaTitik(m.jenis) && m.x2 !== undefined ? ` → ${langkah(m.x2 ?? 0)}, ${langkah(m.y2 ?? 0)}` : ''}
                  {m.kruIds?.length ? ` · Kru: ${ringkasKruProperti(m, rosterById)}` : ''}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="px-1.5"
                title="Ubah penanda"
                onClick={() => setEdit({ draf: { ...m }, baru: false })}
              >
                ✎
              </Button>
              <ConfirmButton onConfirm={() => hapus(m.id)} message="Yakin?" label="✕" />
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={!!edit}
        onClose={() => {
          setEdit(null)
          setPetik(null)
        }}
        title={edit?.baru ? 'Tambah penanda' : 'Ubah penanda'}
        footer={
          <>
            <Button
              variant="ghost"
              onClick={() => {
                setEdit(null)
                setPetik(null)
              }}
            >
              Batal
            </Button>
            <Button variant="primary" onClick={simpan} data-testid="simpan-penanda">
              Simpan
            </Button>
          </>
        }
      >
        {draf && (
          <div className="space-y-3">
            <Field label="Jenis penanda">
              <Select
                value={draf.jenis}
                onChange={(e) => ubah({ jenis: e.target.value as MarkerKind })}
                data-testid="jenis-penanda"
              >
                {JENIS_PENANDA.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.ikon} {j.label}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Nama / label" hint="muncul di sebelah penanda">
              <Input
                value={draf.label}
                onChange={(e) => ubah({ label: e.target.value })}
                placeholder="mis. Podium"
                data-testid="label-penanda"
              />
            </Field>

            <div>
              <p className="mb-1.5 block text-xs font-medium text-slate-400">Warna</p>
              <div className="flex flex-wrap gap-1.5">
                {WARNA_PENANDA.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => ubah({ warna: w })}
                    aria-label={`Warna ${w}`}
                    className={draf.warna === w ? 'h-6 w-6 rounded-full ring-2 ring-white' : 'h-6 w-6 rounded-full'}
                    style={{ background: w }}
                  />
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label={`X ${dua ? 'awal' : ''} (langkah)`}>
                <Input
                  type="number"
                  step="0.25"
                  value={Math.round((draf.x / sYd) * 4) / 4}
                  onChange={(e) => ubah({ x: (Number(e.target.value) || 0) * sYd })}
                />
              </Field>
              <Field label={`Y ${dua ? 'awal' : ''} (langkah)`}>
                <Input
                  type="number"
                  step="0.25"
                  value={Math.round((draf.y / sYd) * 4) / 4}
                  onChange={(e) => ubah({ y: (Number(e.target.value) || 0) * sYd })}
                />
              </Field>
              {dua && (
                <>
                  <Field label="X akhir (langkah)">
                    <Input
                      type="number"
                      step="0.25"
                      value={Math.round(((draf.x2 ?? 0) / sYd) * 4) / 4}
                      onChange={(e) => ubah({ x2: (Number(e.target.value) || 0) * sYd })}
                    />
                  </Field>
                  <Field label="Y akhir (langkah)">
                    <Input
                      type="number"
                      step="0.25"
                      value={Math.round(((draf.y2 ?? 0) / sYd) * 4) / 4}
                      onChange={(e) => ubah({ y2: (Number(e.target.value) || 0) * sYd })}
                    />
                  </Field>
                </>
              )}
              {draf.jenis === 'titik' && (
                <Field label="Jari-jari (langkah)">
                  <Input
                    type="number"
                    step="0.25"
                    value={Math.round(((draf.r ?? 1.6) / sYd) * 4) / 4}
                    onChange={(e) => ubah({ r: Math.max(0.25, (Number(e.target.value) || 1) * sYd) })}
                  />
                </Field>
              )}
              <Field label="Sudut putar (°)">
                <Input
                  type="number"
                  step="5"
                  data-testid="rotasi-penanda"
                  value={draf.rotasi ?? 0}
                  onChange={(e) => ubah({ rotasi: Number(e.target.value) || 0 })}
                />
              </Field>
            </div>

            {/* #16.4 — Properti bergerak per Set */}
            {setAktif && (
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
                <label className="flex items-center gap-2 text-xs font-medium text-slate-200">
                  <input
                    type="checkbox"
                    className="accent-amber-500"
                    data-testid="toggle-penanda-perset"
                    checked={Boolean(kfSetAktif)}
                    onChange={(e) => jugKeyframeSetAktif(e.target.checked)}
                  />
                  <span>Posisi khusus di Set {setAktif.name} (Properti bergerak)</span>
                </label>
                {kfSetAktif ? (
                  <div className="mt-2.5 grid grid-cols-3 gap-2">
                    <Field label="X set ini (lk)">
                      <Input
                        type="number"
                        step="0.25"
                        data-testid="penanda-perset-x"
                        value={Math.round((kfSetAktif.x / sYd) * 4) / 4}
                        onChange={(e) =>
                          ubahKeyframeSetAktif({ x: (Number(e.target.value) || 0) * sYd })
                        }
                      />
                    </Field>
                    <Field label="Y set ini (lk)">
                      <Input
                        type="number"
                        step="0.25"
                        data-testid="penanda-perset-y"
                        value={Math.round((kfSetAktif.y / sYd) * 4) / 4}
                        onChange={(e) =>
                          ubahKeyframeSetAktif({ y: (Number(e.target.value) || 0) * sYd })
                        }
                      />
                    </Field>
                    <Field label="Rotasi (°)">
                      <Input
                        type="number"
                        step="5"
                        data-testid="penanda-perset-rotasi"
                        value={kfSetAktif.rotasi ?? 0}
                        onChange={(e) =>
                          ubahKeyframeSetAktif({ rotasi: Number(e.target.value) || 0 })
                        }
                      />
                    </Field>
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
                    Centang bila properti ini berpindah atau berputar saat memasuki Set {setAktif.name}.
                    Gerakannya akan diinterpolasi mulus saat diputar.
                  </p>
                )}
              </div>
            )}

            {/* #16.4 — Kru pendorong properti */}
            {roster.length > 0 && (
              <div className="rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
                <p className="text-xs font-medium text-slate-300">
                  Kru pendorong / penanggung jawab properti ({draf.kruIds?.length ?? 0})
                </p>
                <div className="mt-1.5 flex max-h-28 flex-wrap gap-1 overflow-y-auto" data-testid="pilihan-kru-penanda">
                  {roster.map((m) => {
                    const aktif = Boolean(draf.kruIds?.includes(m.id))
                    return (
                      <button
                        key={m.id}
                        type="button"
                        data-testid={`kru-penanda-${m.id}`}
                        onClick={() => jugKru(m.id)}
                        className={
                          aktif
                            ? 'rounded border border-amber-500/60 bg-amber-500/20 px-2 py-0.5 text-[11px] font-semibold text-amber-200'
                            : 'rounded border border-slate-700 bg-slate-900 px-2 py-0.5 text-[11px] text-slate-400 hover:bg-slate-800'
                        }
                      >
                        {m.code}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            <div className="rounded-lg bg-slate-950/50 p-2.5">
              {petik ? (
                <p className="text-[11px] leading-relaxed text-emerald-300">
                  {petik.tahap === 1
                    ? 'Sentuh lapangan untuk menentukan titik awal…'
                    : 'Titik awal tersimpan. Sentuh lagi untuk ujungnya.'}
                </p>
              ) : (
                <p className="text-[11px] leading-relaxed text-slate-500">
                  Koordinat bisa diketik di atas, atau{' '}
                  <b>petik langsung dari lapangan</b> — tombol di bawah, lalu sentuh lapangan
                  {dua ? ' dua kali (awal, lalu ujung)' : ' sekali'}.
                </p>
              )}
              <Button
                size="sm"
                variant={petik ? 'primary' : 'soft'}
                className="mt-2"
                data-testid="petik-penanda"
                onClick={() => {
                  if (petik) setPetik(null)
                  else {
                    // Dialog ditutup dulu — kalau tidak, lapangannya tertutup
                    // overlay dialog dan tidak bisa disentuh.
                    setEdit(null)
                    setPetik({ draf, tahap: 1 })
                  }
                }}
              >
                {petik ? 'Batalkan memetik' : 'Petik dari lapangan'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </Card>
  )
}

/** Baris tabel penanda untuk dot sheet yang dicetak. */
export function barisPenandaCetak(
  markers: FieldMarker[],
  sYd: number,
  rosterById?: Map<string, Pick<Member, 'code' | 'name'>>,
): string {
  if (!markers.length) return ''
  const langkah = (v: number) => `${Math.round((v / sYd) * 4) / 4}`
  return `<section class="page">
      <header><div><h2>Penanda &amp; properti lapangan</h2></div></header>
      <table>
        <thead><tr><th>Jenis</th><th>Label</th><th>Koordinat dasar (langkah)</th><th>Keterangan</th></tr></thead>
        <tbody>
          ${markers
            .map((m) => {
              const ket: string[] = []
              if (m.rotasi) ket.push(`Putar ${m.rotasi}&deg;`)
              if (apakahPropertiBergerak(m)) {
                ket.push(`Bergerak (${Object.keys(m.perSet ?? {}).length} set)`)
              }
              if (m.kruIds?.length && rosterById) {
                ket.push(`Kru: ${esc(ringkasKruProperti(m, rosterById))}`)
              }
              return `<tr><td>${esc(infoJenis(m.jenis).label)}</td><td>${esc(m.label)}</td><td class="mono">${langkah(m.x)}, ${langkah(m.y)}${
                butuhDuaTitik(m.jenis) && m.x2 !== undefined ? ` → ${langkah(m.x2 ?? 0)}, ${langkah(m.y2 ?? 0)}` : ''
              }</td><td>${ket.join(' &middot; ') || '-'}</td></tr>`
            })
            .join('')}
        </tbody>
      </table>
    </section>`
}

/** Daftar penanda untuk halaman drill (dipakai ringkasan & ekspor). */
export function ringkasPenanda(drill: Drill): string[] {
  return (drill.markers ?? []).map(
    (m) =>
      `${infoJenis(m.jenis).label} — ${m.label}${
        m.x2 !== undefined ? ` (${m.x}→${m.x2})` : ` (${m.x}, ${m.y})`
      }`,
  )
}
