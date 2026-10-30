import { useEffect, useMemo, useRef, useState } from "react"
import { DEFAULT_FIELD } from "../../db/db"
import type {
  DrillSet,
  FieldConfig,
  Member,
  MemberNote,
  ShareBundle,
  TargetSetoran,
} from "../../db/types"
import { FieldSurface } from "../FieldSurface"
import { MarkerLayer } from "../FieldMarkers"
import { Badge, Button, Card, EmptyState, Select, StatTile } from "../ui"
import { IconLoop, IconPause, IconPlay } from "../Icons"
import {
  bangunPetaFtl,
  deltaPoliFtl,
  gerakOf,
  kelompokPemain,
  progresPemain,
  ringkasKoreografiSet,
  titikJalur,
} from "../../lib/gerak"
import { penandaEfektifPadaSet, tugasKruPropertiAnggota } from "../../lib/propertiGerak"
import {
  LABEL_JENJANG_SETORAN,
  LABEL_KATEGORI_SETORAN,
  WARNA_JENJANG_GELAP,
  apakahLulusSetoran,
  batasLulusEfektif,
  hitungRingkasanSetoranTim,
  idCatatanSetoran,
  targetBerlakuUntukAnggota,
  urutkanTargetSetoran,
} from "../../lib/setoran"
import { sectionDot, STATUS_META, daysFromToday, formatDateLong, pct, todayISO } from "../../lib/utils"
import { coordText, facingDeg, stepYd, ukurTitik } from "../../lib/field"
import { acakUrutan, bangunSoal, nilaiTebakan, TOLERANSI_LANGKAH, type NilaiTebakan } from "../../lib/kuis"


/**
 * Tab "Formasi" untuk anggota.
 *
 * Isinya: pilihan drill, navigasi set memakai tombol besar (‹ ›), peta posisi
 * dengan titiknya sendiri ditandai lingkaran emas, koordinat & jumlah langkah,
 * informasi **asal** (set sebelumnya) dan **tujuan** (set berikutnya), serta
 * tombol **Putar** untuk melihat perpindahannya beranimasi — supaya anggota
 * bisa berlatih mandiri tanpa harus menunggu pelatih.
 */
export function MemberDrill({ bundle, me, members }: { bundle: ShareBundle; me: Member; members: Member[] }) {
  const [drillId, setDrillId] = useState(bundle.drills[0]?.id ?? '')
  const [setId, setSetId] = useState('')
  const [playing, setPlaying] = useState(false)

  const drill = bundle.drills.find((d) => d.id === drillId) ?? bundle.drills[0]
  const sets: DrillSet[] = useMemo(
    () => bundle.sets.filter((s) => s.drillId === drill?.id).sort((a, b) => a.order - b.order),
    [bundle.sets, drill?.id],
  )
  useEffect(() => {
    if (sets.length && !sets.some((s) => s.id === setId)) setSetId(sets[0].id)
  }, [sets, setId])

  const f: FieldConfig = drill?.field ?? DEFAULT_FIELD
  /** Ukuran titik mengikuti luas lapangan — sama seperti di editor. */
  const uk = (n: number) => ukurTitik(f, n)
  const sYd = stepYd(f)
  const halfW = f.widthYd / 2
  const halfL = (f.lengthYd + f.endZoneYd * 2) / 2
  const VW = f.lengthYd + f.endZoneYd * 2
  const VH = f.widthYd
  const sx = (x: number) => halfL - x
  const sy = (y: number) => halfW - y

  const idxSet = sets.findIndex((s) => s.id === setId)
  const set = sets[idxSet] ?? sets[0]
  const prevSet = idxSet > 0 ? sets[idxSet - 1] : undefined
  const nextSet = idxSet >= 0 && idxSet < sets.length - 1 ? sets[idxSet + 1] : undefined
  const myPoint = set?.points?.[me.id]
  const myPrev = prevSet?.points?.[me.id]
  const myNext = nextSet?.points?.[me.id]

  /** Elemen <g> tiap titik — dipakai untuk menggerakkan saat animasi. */
  const dotRefs = useRef(new Map<string, SVGGElement>())
  const rafRef = useRef(0)

  /**
   * Animasi perpindahan ke set berikutnya. Sama seperti mode presenter: titik
   * digerakkan lewat atribut `transform`, tanpa render ulang React per frame,
   * supaya tetap mulus walau timnya 80 orang. Setelah selesai, set aktif maju.
   */
  useEffect(() => {
    if (!playing || !set || !nextSet || !drill) {
      setPlaying(false)
      return
    }
    const counts = Math.max(1, set.counts ?? 8)
    const total = counts * drill.beatsPerCount * (60_000 / Math.max(20, drill.tempo))
    const t0 = performance.now()
    const vec: [string, number, number][] = []
    const awalSvg: Record<string, { x: number; y: number }> = {}
    const akhirSvg: Record<string, { x: number; y: number }> = {}
    for (const [id, p] of Object.entries(set.points ?? {})) {
      awalSvg[id] = { x: sx(p.x), y: sy(p.y) }
      const q = nextSet.points[id]
      if (!q) continue
      akhirSvg[id] = { x: sx(q.x), y: sy(q.y) }
      vec.push([id, sx(q.x) - sx(p.x), sy(q.y) - sy(p.y)])
    }
    const gr = gerakOf(set.gerak)
    const lengkung = gr.jalur === 'lengkung' ? gr.lengkung : 0
    const petaFtl = gr.kelompok?.length ? bangunPetaFtl(gr.kelompok, awalSvg, akhirSvg) : new Map()
    const seksiMap = new Map(members.map((m) => [m.id, m.section]))
    const loop = () => {
      const p = Math.min(1, (performance.now() - t0) / total)
      for (const [id, vx, vy] of vec) {
        const g = dotRefs.current.get(id)
        if (!g) continue
        const t = progresPemain(p, gr, seksiMap.get(id), counts, id)
        const ftl = petaFtl.get(id)
        const klp = kelompokPemain(gr, id)
        const [tx, ty] = ftl
          ? deltaPoliFtl(ftl, t)
          : klp
            ? titikJalur(t, vx, vy, klp.jalur === 'lengkung' ? (klp.lengkung ?? 0.4) : 0)
            : titikJalur(t, vx, vy, lengkung)
        g.setAttribute('transform', `translate(${tx} ${ty})`)
      }
      if (p < 1) {
        rafRef.current = requestAnimationFrame(loop)
      } else {
        for (const [id] of vec) dotRefs.current.get(id)?.removeAttribute('transform')
        setPlaying(false)
        setSetId(nextSet.id)
      }
    }
    rafRef.current = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(rafRef.current)
      for (const [id] of vec) dotRefs.current.get(id)?.removeAttribute('transform')
    }
  }, [playing, set, nextSet, drill, members])

  const gantiSet = (arah: number) => {
    setPlaying(false)
    const i = Math.min(Math.max(0, idxSet + arah), sets.length - 1)
    if (sets[i]) setSetId(sets[i].id)
  }

  if (!drill) return <EmptyState title="Paket ini tidak berisi formasi" />

  const jarak = (a?: { x: number; y: number }, b?: { x: number; y: number }) =>
    a && b ? Math.round(Math.hypot(b.x - a.x, b.y - a.y) / sYd) : null

  return (
    <div className="space-y-3">
      <Card>
        <Select value={drillId} onChange={(e) => setDrillId(e.target.value)} className="mb-2 w-full">
          {bundle.drills.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>

        {/* Navigasi set — tombol besar supaya mudah dipakai di HP */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => gantiSet(-1)}
            disabled={idxSet <= 0}
            className="grid h-12 w-14 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-2xl text-slate-100 active:scale-[.97] disabled:opacity-30"
            title="Set sebelumnya"
          >
            ‹
          </button>
          <div className="min-w-0 flex-1 text-center">
            <p className="truncate text-sm font-medium text-slate-100">{set?.name}</p>
            <p className="text-[11px] text-slate-500">
              Set {idxSet + 1} dari {sets.length} · {set?.counts ?? 0} count
            </p>
          </div>
          <button
            type="button"
            onClick={() => gantiSet(1)}
            disabled={idxSet >= sets.length - 1}
            className="grid h-12 w-14 place-items-center rounded-xl border border-slate-700 bg-slate-900 text-2xl text-slate-100 active:scale-[.97] disabled:opacity-30"
            title="Set berikutnya"
          >
            ›
          </button>
        </div>

        {nextSet && (
          <Button
            className="mt-2 w-full"
            variant={playing ? 'danger' : 'primary'}
            onClick={() => setPlaying((p) => !p)}
          >
            {playing ? <IconPause size={16} /> : <IconPlay size={16} />}
            {playing ? 'Jeda' : `Putar perpindahan ke ${nextSet.name}`}
          </Button>
        )}
      </Card>

      <Card padded={false} className="overflow-hidden">
        <div className="bg-slate-950 p-2">
          <svg viewBox={`0 0 ${VW} ${VH}`} className="w-full">
            <FieldSurface f={f} VW={VW} VH={VH} sx={sx} sy={sy} />
            {(drill.markers?.length ?? 0) > 0 && (
              <MarkerLayer
                markers={penandaEfektifPadaSet(drill.markers ?? [], sets, idxSet)}
                sx={sx}
                sy={sy}
              />
            )}
            {nextSet &&
              Object.entries(set?.points ?? {}).map(([id, p]) => {
                const q = nextSet.points[id]
                if (!q) return null
                return (
                  <line
                    key={`p-${id}`}
                    x1={sx(p.x)}
                    y1={sy(p.y)}
                    x2={sx(q.x)}
                    y2={sy(q.y)}
                    stroke="rgba(255,255,255,0.35)"
                    strokeWidth={id === me.id ? 0.4 : 0.15}
                    strokeDasharray="1 1"
                  />
                )
              })}
            {Object.entries(set?.points ?? {}).map(([id, p]) => {
              const m = members.find((x) => x.id === id)
              if (!m) return null
              const mine = id === me.id
              const deg = facingDeg(p.facing, p.facingDeg)
              const rad = (deg * Math.PI) / 180
              return (
                <g
                  key={id}
                  ref={(el) => {
                    if (el) dotRefs.current.set(id, el)
                    else dotRefs.current.delete(id)
                  }}
                >
                  <line
                    x1={sx(p.x)}
                    y1={sy(p.y)}
                    x2={sx(p.x) - Math.sin(rad) * 1.6}
                    y2={sy(p.y) + Math.cos(rad) * 1.6}
                    stroke={sectionDot(m.section)}
                    strokeWidth={0.35}
                  />
                  <circle
                    cx={sx(p.x)}
                    cy={sy(p.y)}
                    r={uk(mine ? 2.2 : 1.15)}
                    fill={sectionDot(m.section)}
                    stroke={mine ? '#fbbf24' : '#0b1120'}
                    strokeWidth={uk(mine ? 0.6 : 0.18)}
                  />
                  {mine && (
                    <circle
                      cx={sx(p.x)}
                      cy={sy(p.y)}
                      r={uk(3.4)}
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth={uk(0.3)}
                      strokeDasharray="1 0.8"
                    />
                  )}
                  <text
                    x={sx(p.x)}
                    y={sy(p.y) + 0.45}
                    textAnchor="middle"
                    fontSize={mine ? 1.6 : 1.1}
                    fill="#0b1120"
                    style={{ fontWeight: 700 }}
                  >
                    {m.code}
                  </text>
                </g>
              )
            })}
          </svg>
        </div>
        <div className="border-t border-slate-800 px-3 py-2 text-[11px] text-slate-500">
          Titikmu ditandai lingkaran emas · ukuran langkah {Math.round((1 / sYd) * 10) / 10} langkah/yard
        </div>
      </Card>

      <Card>
        <h3 className="mb-2 text-sm font-semibold text-slate-200">Posisiku — {set?.name}</h3>
        {set && ringkasKoreografiSet(set, { memberId: me.id, sectionId: me.section }).length > 0 && (
          <div
            className="mb-2.5 flex flex-wrap gap-1.5 rounded-lg border border-sky-700/40 bg-sky-950/30 px-2.5 py-2"
            data-testid="anggota-isyarat-koreo"
          >
            {ringkasKoreografiSet(set, { memberId: me.id, sectionId: me.section }).map((isy, i) => (
              <span
                key={`isy-${i}`}
                className="rounded-md bg-sky-900/60 px-2 py-0.5 text-[11px] font-semibold text-sky-200"
              >
                {isy}
              </span>
            ))}
          </div>
        )}
        {tugasKruPropertiAnggota(drill.markers ?? [], me.id).length > 0 && (
          <div
            className="mb-2.5 rounded-lg border border-amber-700/40 bg-amber-950/25 px-2.5 py-2 text-[11px] text-amber-200"
            data-testid="anggota-kru-properti"
          >
            <b>Tugas kru properti:</b>{' '}
            {tugasKruPropertiAnggota(drill.markers ?? [], me.id)
              .map((mk) => mk.label)
              .join(', ')}
          </div>
        )}
        {myPoint ? (
          <>
            <p className="rounded-lg bg-slate-950/60 px-3 py-2.5 font-mono text-sm text-emerald-300">
              {coordText(myPoint.x, myPoint.y, f)}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <StatTile
                label="Langkah dari garis 50"
                value={Math.round((myPoint.x / sYd) * 4) / 4}
                sub={myPoint.x >= 0 ? 'arah Side 1' : 'arah Side 2'}
              />
              <StatTile
                label="Langkah dari garis depan"
                value={Math.round(((myPoint.y + f.widthYd / 2) / sYd) * 4) / 4}
                sub="front sideline = 0"
              />
            </div>

            {/* Asal: set sebelumnya */}
            {prevSet && (
              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-xs font-medium text-slate-300">
                  Dari {prevSet.name}: {prevSet.counts ?? 0} count
                  {jarak(myPrev, myPoint) !== null && (
                    <>
                      {' '}
                      · jarak <b className="text-sky-400">{jarak(myPrev, myPoint)}</b> langkah
                    </>
                  )}
                </p>
                {myPrev && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Asal: {coordText(myPrev.x, myPrev.y, f)}
                  </p>
                )}
              </div>
            )}

            {/* Tujuan: set berikutnya */}
            {nextSet && (
              <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3">
                <p className="text-xs font-medium text-slate-300">
                  Gerakan ke {nextSet.name}: {set?.counts ?? 0} count
                  {jarak(myPoint, myNext) !== null && (
                    <>
                      {' '}
                      · jarak <b className="text-emerald-400">{jarak(myPoint, myNext)}</b> langkah
                    </>
                  )}
                </p>
                {myNext && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Tujuan: {coordText(myNext.x, myNext.y, f)} ·{' '}
                    {Math.round(((set?.counts ?? 0) * 60) / drill.tempo)} detik pada {drill.tempo} BPM
                  </p>
                )}
              </div>
            )}
          </>
        ) : (
          <p className="text-sm text-slate-400">Kamu tidak ada di set ini (mungkin istirahat/prop).</p>
        )}
      </Card>
    </div>
  )
}

/**
 * C2 — tab "Kuis" untuk anggota: tebak posisi sendiri di set berikutnya.
 *
 * Satu soal per perpindahan set (berurutan, atau acak bila diminta). Peta
 * menampilkan set ASAL — titik sendiri berlingkaran emas, seperti tab
 * Formasi — tetapi TANPA garis perpindahan: di situlah soalnya. Anggota
 * mengetuk peta untuk meletakkan tebakan (bisa digeser dengan mengetuk
 * lagi), lalu mengunci jawaban. Benar bila dalam toleransi langkah dari
 * kunci. Baca-saja: tidak menulis apa pun ke basis data.
 */
export function MemberKuis({ bundle, me, members }: { bundle: ShareBundle; me: Member; members: Member[] }) {
  const [drillId, setDrillId] = useState(bundle.drills[0]?.id ?? '')
  /** 0 = urutan set; selain itu benih acakan (lihat `acakUrutan`). */
  const [benih, setBenih] = useState(0)
  const [idx, setIdx] = useState(0)
  const [tebakan, setTebakan] = useState<{ x: number; y: number } | null>(null)
  const [terkunci, setTerkunci] = useState<NilaiTebakan | null>(null)
  const [benar, setBenar] = useState(0)

  const drill = bundle.drills.find((d) => d.id === drillId) ?? bundle.drills[0]
  const sets: DrillSet[] = useMemo(
    () => bundle.sets.filter((s) => s.drillId === drill?.id).sort((a, b) => a.order - b.order),
    [bundle.sets, drill?.id],
  )
  const soal = useMemo(() => acakUrutan(bangunSoal(sets, me.id), benih), [sets, me.id, benih])
  const selesai = idx >= soal.length
  const kini = selesai ? undefined : soal[idx]

  const f: FieldConfig = drill?.field ?? DEFAULT_FIELD
  const uk = (n: number) => ukurTitik(f, n)
  const sYd = stepYd(f)
  const halfW = f.widthYd / 2
  const halfL = (f.lengthYd + f.endZoneYd * 2) / 2
  const VW = f.lengthYd + f.endZoneYd * 2
  const VH = f.widthYd
  const sx = (x: number) => halfL - x
  const sy = (y: number) => halfW - y

  const petaAsal = kini ? sets.find((s) => s.id === kini.dariSetId) : undefined
  const dijawab = Math.min(idx + (terkunci ? 1 : 0), soal.length)

  function ulang(acak: boolean) {
    setIdx(0)
    setTebakan(null)
    setTerkunci(null)
    setBenar(0)
    setBenih(acak ? Date.now() : 0)
  }

  function ketukPeta(e: { clientX: number; clientY: number; currentTarget: SVGSVGElement }) {
    if (terkunci || !kini) return
    const r = e.currentTarget.getBoundingClientRect()
    if (r.width <= 0 || r.height <= 0) return
    // Balik proyeksi peta: sx = halfL − x, jadi x = halfL − vx.
    setTebakan({
      x: halfL - ((e.clientX - r.left) / r.width) * VW,
      y: halfW - ((e.clientY - r.top) / r.height) * VH,
    })
  }

  function kunci() {
    if (!kini || !tebakan || terkunci) return
    const nilai = nilaiTebakan(tebakan, kini.kunci, sYd)
    setTerkunci(nilai)
    if (nilai.benar) setBenar((b) => b + 1)
  }

  function lanjut() {
    setIdx((i) => i + 1)
    setTebakan(null)
    setTerkunci(null)
  }

  if (!drill) return <EmptyState title="Paket ini tidak berisi formasi" />

  return (
    <div className="space-y-3" data-kiosk-allow>
      <Card>
        <Select
          value={drill.id}
          onChange={(e) => {
            setDrillId(e.target.value)
            ulang(false)
          }}
          className="mb-2 w-full"
        >
          {bundle.drills.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </Select>
        <div className="flex items-center justify-between gap-2">
          <p data-testid="soal-ke" className="text-xs text-slate-400">
            {soal.length ? (selesai ? `Selesai — ${soal.length} soal` : `Soal ${idx + 1} dari ${soal.length}`) : 'Belum ada soal'}
            {benih !== 0 && soal.length ? ' · acak' : ''}
          </p>
          <p data-testid="skor-kuis" className="text-xs font-medium text-slate-300">
            Benar {benar} dari {dijawab}
          </p>
        </div>
        {soal.length > 1 && !selesai && (
          <Button size="sm" variant="ghost" data-testid="acak-kuis" onClick={() => ulang(true)} className="mt-2 w-full">
            <IconLoop size={14} /> Acak urutan
          </Button>
        )}
      </Card>

      {!soal.length ? (
        <EmptyState
          title="Belum bisa kuis"
          desc="Kamu harus ada di dua set berurutan supaya ada yang ditebak. Minta pelatih menambah set."
        />
      ) : selesai ? (
        <Card data-testid="selesai-kuis">
          <h3 className="mb-1 text-sm font-semibold text-slate-200">Kuis selesai</h3>
          <p className="mb-3 text-sm text-slate-400">
            Skor: <b className="text-emerald-400">{benar}</b> benar dari {soal.length} soal
            {benar === soal.length && soal.length > 0 ? ' — hafal semua!' : '.'}
          </p>
          <div className="flex gap-2">
            <Button data-testid="ulang-kuis" onClick={() => ulang(false)} className="flex-1">
              Main lagi
            </Button>
            <Button variant="ghost" onClick={() => ulang(true)} className="flex-1">
              Acak & main lagi
            </Button>
          </div>
        </Card>
      ) : (
        kini && (
          <>
            <Card>
              <p className="text-sm text-slate-200">
                Dari <b>{kini.dariNama}</b> ke <b>{kini.keNama}</b> · {kini.counts} count
              </p>
              <p className="mt-0.5 text-xs text-slate-500">
                Ketuk posisimu di {kini.keNama} — kunci jawaban bila sudah yakin.
              </p>
            </Card>

            <Card padded={false} className="overflow-hidden">
              <div className="bg-slate-950 p-2">
                <svg
                  data-testid="peta-kuis"
                  viewBox={`0 0 ${VW} ${VH}`}
                  className="w-full cursor-crosshair touch-manipulation"
                  onClick={ketukPeta}
                >
                  <FieldSurface f={f} VW={VW} VH={VH} sx={sx} sy={sy} />
                  {Object.entries(petaAsal?.points ?? {}).map(([id, p]) => {
                    const m = members.find((x) => x.id === id)
                    if (!m) return null
                    const mine = id === me.id
                    const deg = facingDeg(p.facing, p.facingDeg)
                    const rad = (deg * Math.PI) / 180
                    return (
                      <g key={id}>
                        <line
                          x1={sx(p.x)}
                          y1={sy(p.y)}
                          x2={sx(p.x) - Math.sin(rad) * 1.6}
                          y2={sy(p.y) + Math.cos(rad) * 1.6}
                          stroke={sectionDot(m.section)}
                          strokeWidth={0.35}
                        />
                        <circle
                          cx={sx(p.x)}
                          cy={sy(p.y)}
                          r={uk(mine ? 2.2 : 1.15)}
                          fill={sectionDot(m.section)}
                          stroke={mine ? '#fbbf24' : '#0b1120'}
                          strokeWidth={uk(mine ? 0.6 : 0.18)}
                        />
                        {mine && (
                          <circle
                            cx={sx(p.x)}
                            cy={sy(p.y)}
                            r={uk(3.4)}
                            fill="none"
                            stroke="#fbbf24"
                            strokeWidth={uk(0.3)}
                            strokeDasharray="1 0.8"
                          />
                        )}
                        <text
                          x={sx(p.x)}
                          y={sy(p.y) + 0.45}
                          textAnchor="middle"
                          fontSize={mine ? 1.6 : 1.1}
                          fill="#0b1120"
                          style={{ fontWeight: 700 }}
                        >
                          {m.code}
                        </text>
                      </g>
                    )
                  })}
                  {tebakan && (
                    <g data-testid="penanda-tebakan">
                      <circle
                        cx={sx(tebakan.x)}
                        cy={sy(tebakan.y)}
                        r={uk(2.6)}
                        fill="rgba(56,189,248,.35)"
                        stroke="#38bdf8"
                        strokeWidth={uk(0.5)}
                      />
                      <line
                        x1={sx(tebakan.x) - uk(1.2)}
                        y1={sy(tebakan.y)}
                        x2={sx(tebakan.x) + uk(1.2)}
                        y2={sy(tebakan.y)}
                        stroke="#38bdf8"
                        strokeWidth={uk(0.4)}
                      />
                      <line
                        x1={sx(tebakan.x)}
                        y1={sy(tebakan.y) - uk(1.2)}
                        x2={sx(tebakan.x)}
                        y2={sy(tebakan.y) + uk(1.2)}
                        stroke="#38bdf8"
                        strokeWidth={uk(0.4)}
                      />
                    </g>
                  )}
                  {terkunci && tebakan && (
                    <g data-testid="penanda-kunci">
                      <line
                        x1={sx(tebakan.x)}
                        y1={sy(tebakan.y)}
                        x2={sx(kini.kunci.x)}
                        y2={sy(kini.kunci.y)}
                        stroke="rgba(52,211,153,.7)"
                        strokeWidth={uk(0.35)}
                        strokeDasharray="1 1"
                      />
                      <circle
                        cx={sx(kini.kunci.x)}
                        cy={sy(kini.kunci.y)}
                        r={uk(2.2)}
                        fill="none"
                        stroke="#34d399"
                        strokeWidth={uk(0.6)}
                      />
                    </g>
                  )}
                </svg>
              </div>
              <div className="border-t border-slate-800 px-3 py-2 text-[11px] text-slate-500">
                {terkunci
                  ? 'Biru = tebakanmu · hijau = kunci'
                  : tebakan
                    ? 'Ketuk lagi untuk menggeser, lalu kunci jawaban.'
                    : 'Ketuk peta untuk meletakkan tebakanmu.'}
              </div>
            </Card>

            {!terkunci ? (
              <Button
                data-testid="kunci-jawaban"
                variant="primary"
                disabled={!tebakan}
                onClick={kunci}
                className="w-full"
              >
                Kunci jawaban
              </Button>
            ) : (
              <Card data-testid="hasil-kuis">
                <p className={`text-sm font-semibold ${terkunci.benar ? 'text-emerald-400' : 'text-amber-400'}`}>
                  {terkunci.benar ? 'Tepat!' : 'Belum tepat.'}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  Jarak tebakanmu {terkunci.jarakLangkah} langkah (toleransi {TOLERANSI_LANGKAH}).
                </p>
                <p data-testid="kunci-koor" className="mt-2 rounded-lg bg-slate-950/60 px-3 py-2 font-mono text-sm text-emerald-300">
                  {coordText(kini.kunci.x, kini.kunci.y, f)}
                </p>
                <Button data-testid="lanjut-kuis" onClick={lanjut} className="mt-3 w-full">
                  {idx + 1 >= soal.length ? 'Lihat skor' : 'Lanjut'}
                </Button>
              </Card>
            )}
          </>
        )
      )}
    </div>
  )
}

/**
 * Tab "Catatan" — tanggungan setoran hafalan (#14) & catatan evaluasi pribadi pelatih.
 * Hanya data untuk anggota yang sedang dipilih yang ditampilkan.
 */
export function MemberNotes({
  bundle,
  bundleGrup,
  me,
  locked,
  onLatihDiMusik,
}: {
  bundle: ShareBundle
  bundleGrup: ShareBundle
  me: Member
  locked?: boolean
  onLatihDiMusik: (t: TargetSetoran) => void
}) {
  const notes: MemberNote[] = useMemo(
    () => (bundle.memberNotes ?? []).filter((n) => n.memberId === me.id).sort((a, b) => b.at - a.at),
    [bundle.memberNotes, me.id],
  )

  const semuaTarget = useMemo(
    () => urutkanTargetSetoran(bundleGrup.targetSetoran ?? bundle.targetSetoran ?? []),
    [bundleGrup.targetSetoran, bundle.targetSetoran],
  )
  const targetWajib = useMemo(
    () => semuaTarget.filter((t) => targetBerlakuUntukAnggota(t, me)),
    [semuaTarget, me],
  )
  const catatanSetoranMilikku = useMemo(
    () => (bundle.setoran ?? []).filter((s) => s.memberId === me.id),
    [bundle.setoran, me.id],
  )
  const ringkasanSaya = useMemo(
    () => hitungRingkasanSetoranTim(targetWajib, catatanSetoranMilikku, [me], [], todayISO()),
    [targetWajib, catatanSetoranMilikku, me],
  )
  const punyaAksesPribadi = Boolean(locked || bundleGrup.forMember === me.id)
  const petaLagu = useMemo(
    () => new Map((bundleGrup.songs ?? []).map((s) => [s.id, s])),
    [bundleGrup.songs],
  )
  const hariIni = todayISO()

  if (!notes.length && targetWajib.length === 0) {
    return (
      <div>
        <EmptyState
          title="Belum ada catatan"
          desc={locked
            ? 'Catatan evaluasi & target setoran dari pelatih akan muncul di sini setelah paket diperbarui.'
            : 'Mintalah QR kunci ke pelatih untuk membuka catatan pribadi, atau tunggu materi diperbarui.'}
        />
      </div>
    )
  }

  const statSaya = ringkasanSaya.perAnggota[me.id]

  return (
    <div className="space-y-4">
      {targetWajib.length > 0 && (
        <Card data-testid="kartu-setoran-anggota">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
            <div>
              <h3 className="text-sm font-semibold text-slate-100">
                Tanggungan Setoran Hafalan
              </h3>
              <p className="text-[11px] text-slate-400">
                {punyaAksesPribadi && statSaya
                  ? `${statSaya.lulus}/${statSaya.wajib} target lulus penuh · Kesiapan ${statSaya.persenSiap}%`
                  : `${targetWajib.length} target untuk seksimu — buka dengan kunci pribadi atau berkas per anggota untuk melihat nilai kelulusan`}
              </p>
            </div>
            {punyaAksesPribadi && statSaya && (
              <span
                data-testid="persen-setoran-anggota"
                className="rounded-full border border-emerald-700/50 bg-emerald-950/50 px-2.5 py-0.5 text-xs font-bold text-emerald-300"
              >
                {statSaya.persenSiap}%
              </span>
            )}
          </div>

          <ul className="mt-2.5 divide-y divide-slate-800/70">
            {targetWajib.map((t) => {
              const sel = ringkasanSaya.petaSel.get(idCatatanSetoran(t.id, me.id))
              const jenjang = sel?.jenjang ?? 'belum'
              const w = WARNA_JENJANG_GELAP[jenjang]
              const lulus = apakahLulusSetoran(jenjang, batasLulusEfektif(t))
              const terlambat = Boolean(t.tenggat && t.tenggat < hariIni && !lulus)
              const lagu = t.songId ? petaLagu.get(t.songId) : undefined

              return (
                <li
                  key={t.id}
                  data-testid={`baris-setoran-anggota-${t.id}`}
                  className="py-2.5 first:pt-0 last:pb-0"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-100">{t.judul}</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">
                        {LABEL_KATEGORI_SETORAN[t.kategori]}
                        {t.biramaDari != null && t.biramaSampai != null
                          ? ` · Birama ${t.biramaDari}–${t.biramaSampai}`
                          : ''}
                        {t.tenggat ? ` · Tenggat ${t.tenggat}` : ''}
                        {terlambat && punyaAksesPribadi ? (
                          <span className="ml-1.5 font-semibold text-rose-400">(Lewat tenggat)</span>
                        ) : null}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      {punyaAksesPribadi && (
                        <span
                          data-testid={`status-setoran-anggota-${t.id}`}
                          style={{
                            backgroundColor: w.bg,
                            borderColor: w.border,
                            color: w.text,
                          }}
                          className="rounded-md border px-2 py-0.5 text-[11px] font-semibold"
                        >
                          {LABEL_JENJANG_SETORAN[jenjang]}
                        </span>
                      )}
                      {lagu && (
                        <Button
                          size="sm"
                          variant="ghost"
                          data-testid={`latih-setoran-${t.id}`}
                          onClick={() => onLatihDiMusik(t)}
                        >
                          Latih di Musik
                        </Button>
                      )}
                    </div>
                  </div>
                  {punyaAksesPribadi && (sel?.catatan || sel?.penguji) && (
                    <p className="mt-1.5 rounded bg-slate-950/60 px-2.5 py-1.5 text-[11px] text-slate-300">
                      {sel.catatan ? sel.catatan : 'Diuji'}
                      {sel.penguji ? (
                        <span className="text-slate-500">
                          {' '}· {sel.penguji} ({sel.tanggal})
                        </span>
                      ) : null}
                    </p>
                  )}
                </li>
              )
            })}
          </ul>
        </Card>
      )}

      {notes.length > 0 && (
        <Card padded={false}>
          <ul className="divide-y divide-slate-800/70">
            {notes.map((n) => (
              <li key={n.id} className="px-4 py-3">
                <p className="mb-1 text-[11px] text-slate-500">
                  {formatDateLong(new Date(n.at).toISOString().slice(0, 10))}
                  {n.by ? ` · ${n.by}` : ''}
                </p>
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-200">{n.text}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

/**
 * Tab "Absensi" milik anggota.
 *
 * Persentase kehadiran dihitung dari sesi yang **dicatat pelatih**, bukan
 * dari seluruh sesi. Dua keadaan yang berbeda bisa menghasilkan angka yang
 * sama — pelatih mencatat 2 dari 5 sesi (dua-duanya hadir) dan pelatih
 * mencatat semua 5 sesi (semuanya hadir) keduanya menampilkan **100%**.
 *
 * Karena itu penyebutnya ditulis di bawah angkanya, persis seperti yang
 * sudah dilakukan layar rekap pelatih sendiri, dan sesi yang sudah lewat
 * tanpa catatan ditampilkan tersendiri sebagai **"Belum dicatat"** —
 * **bukan** digabung ke "tidak hadir". Pelatih yang belum sempat mengisi
 * absensi tidak boleh membuat anggotanya tampak mangkir.
 */
export function MemberAttendance({ bundle, me, locked }: { bundle: ShareBundle; me: Member; locked?: boolean }) {
  const mine = bundle.attendance.filter((a) => a.memberId === me.id)
  const hadir = mine.filter((a) => a.status === 'hadir').length
  const sessions = [...bundle.sessions].sort((a, b) => b.date.localeCompare(a.date))

  /** Sesi yang sudah lewat dan belum punya catatan apa pun. */
  const belumDicatat = sessions.filter(
    (s) => daysFromToday(s.date) < 0 && !mine.some((a) => a.sessionId === s.id),
  )
  const baris = sessions
    .map((s) => ({ s, r: mine.find((a) => a.sessionId === s.id) }))
    .filter(({ s, r }) => r != null || daysFromToday(s.date) < 0)

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        <StatTile label="Hadir" value={hadir} accent="text-emerald-400" />
        <StatTile label="Izin/Sakit" value={mine.filter((a) => a.status === 'izin' || a.status === 'sakit').length} />
        <StatTile
          label="Kehadiran"
          /*
           * Bila pelatih belum mencatat apa pun, jangan menampilkan "0%".
           * Nol persen pada data yang kosong berbunyi sebagai tuduhan
           * mangkir, padahal yang benar adalah "belum ada datanya".
           * Angka yang tidak ada dibedakan dari angka nol.
           */
          value={mine.length ? `${pct(hadir, mine.length)}%` : '—'}
          sub={mine.length ? `${hadir} dari ${mine.length} sesi yang dicatat` : 'belum ada yang dicatat'}
          accent={mine.length ? 'text-emerald-400' : undefined}
        />
      </div>
      {belumDicatat.length > 0 && (
        <p className="text-[11px] leading-relaxed text-slate-500">
          {belumDicatat.length} sesi lain yang sudah lewat belum dicatat pelatih — ditandai{' '}
          <b>Belum dicatat</b> di bawah, bukan berarti tidak hadir.
        </p>
      )}
      <Card padded={false}>
        <ul className="divide-y divide-slate-800/70">
          {baris.map(({ s, r }) => (
            <li key={s.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm text-slate-200">{s.title}</p>
                <p className="text-[11px] text-slate-500">{s.date}</p>
              </div>
              {r ? (
                <Badge className={STATUS_META[r.status].color}>{STATUS_META[r.status].label}</Badge>
              ) : (
                <Badge className="bg-slate-700/40 text-slate-400 border-slate-600/40">Belum dicatat</Badge>
              )}
            </li>
          ))}
        </ul>
        {!baris.length && (
          <div className="p-4">
            <EmptyState
              title="Belum ada catatan kehadiran"
              desc={locked
                ? 'Paket ini belum memuat data absensi.'
                : 'Mintalah QR kunci ke pelatih untuk membuka data kehadiran pribadi.'}
            />
          </div>
        )}
      </Card>
    </div>
  )
}
