import type { FieldConfig } from '../db/types'
import {
  daftarPatok,
  gridUtamaTampil,
  hashGarisTampil,
  patokGarisTampil,
  patokLabelTampil,
  patokOf,
  subgridTampil,
  warnaLapangan,
} from '../lib/field'

/**
 * Gambar lapangan (rumput, end zone, garis yard, hash mark, label yard).
 *
 * Sengaja dipisah dari halaman Drill supaya bisa dipakai ulang oleh tampilan
 * lain yang juga butuh gambar lapangan — misalnya **mode presenter**
 * (src/components/DrillPresenter.tsx) dan pratinjau cetak.
 *
 * Semua ukuran memakai satuan gambar SVG (yard), jadi skala mengikuti
 * `viewBox` milik pemanggil.
 */
export function FieldSurface({
  f,
  VW,
  VH,
  sx,
  sy,
}: {
  f: FieldConfig
  VW: number
  VH: number
  sx: (n: number) => number
  sy: (n: number) => number
}) {
  const playStart = f.endZoneYd // svg x awal area main
  const playEnd = f.endZoneYd + f.lengthYd
  /** DD1 — kalau tim memakai patok, garis & label lapangan mengikuti patok. */
  const patokAktif = patokOf(f).aktif === 1
  /** Warna latar & pilihan garis lapangan (bisa diubah pelatih). */
  const warna = warnaLapangan(f)
  /** 1 = semua garis, 2 = tanpa garis tepi, 0 = semua disembunyikan. */
  const garis = f.garis ?? 1
  const pCfg = patokOf(f)
  const patokGarisOn = patokAktif && patokGarisTampil(pCfg)
  const patokLabelOn = patokAktif && patokLabelTampil(pCfg)
  const patokX = patokAktif ? daftarPatok(f, 'x') : []
  const patokY = patokAktif ? daftarPatok(f, 'y') : []

  const showGridUtama = gridUtamaTampil(f) && garis !== 0
  const showSubgrid = subgridTampil(f) && garis !== 0 && !!f.subgridYd && f.subgridYd > 0 && f.subgridYd < f.gridYd
  const showHash = hashGarisTampil(f) && garis !== 0 && f.hash !== 'none'

  const yardLines: number[] = []
  if (showGridUtama) {
    const step = f.gridYd > 0 ? f.gridYd : 5
    for (let y = -f.lengthYd / 2; y <= f.lengthYd / 2 + 0.001; y += step) yardLines.push(y)
  }
  const subLines: number[] = []
  if (showSubgrid) {
    const step = f.subgridYd!
    for (let y = -f.lengthYd / 2; y <= f.lengthYd / 2 + 0.001; y += step) {
      // jangan duplikat garis utama
      const isUtama = Math.abs((y / f.gridYd) - Math.round(y / f.gridYd)) < 1e-9
      if (!isUtama) subLines.push(y)
    }
  }

  const yardValue = (y: number) => 50 - Math.abs(Math.round(y))

  return (
    <g>
      {/* Rumput */}
      <rect data-lap="rumput" x={0} y={0} width={VW} height={VH} fill={warna.rumput} />
      {/* End zone */}
      {f.endZoneYd > 0 && (
        <>
          <rect data-lap="zona" x={0} y={0} width={f.endZoneYd} height={VH} fill={warna.zona} />
          <rect data-lap="zona" x={playEnd} y={0} width={f.endZoneYd} height={VH} fill={warna.zona} />
        </>
      )}
      {/* Garis yard utama */}
      {showGridUtama &&
        yardLines.map((y) => (
          <line
            key={`yl-${y}`}
            x1={sx(y)}
            y1={0}
            x2={sx(y)}
            y2={VH}
            data-lap="garis"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={y === 0 ? 0.35 : 0.18}
          />
        ))}
      {/* Subgrid — garis lebih tipis di antara garis utama */}
      {showSubgrid &&
        subLines.map((y) => (
          <line
            key={`sub-${y}`}
            x1={sx(y)}
            y1={0}
            x2={sx(y)}
            y2={VH}
            data-lap="subgrid"
            stroke="rgba(255,255,255,0.18)"
            strokeWidth={0.1}
          />
        ))}
      {/* Hash marks — terpisah dari grid utama */}
      {showHash && (
        <>
          {[-1, 1].map((sgn) => {
            const offset = (f.hash === 'nfhs' ? (53 + 4 / 12) / 3 / 2 : f.hash === 'ncaa' ? 40 / 3 / 2 : (18 + 6 / 12) / 3 / 2) * sgn
            return (
              <line
                key={`hash-${sgn}`}
                x1={playStart}
                y1={sy(offset)}
                x2={playEnd}
                y2={sy(offset)}
                data-lap="hash"
                stroke="rgba(255,255,255,0.4)"
                strokeWidth={0.18}
                strokeDasharray="1.2 1.2"
              />
            )
          })}
        </>
      )}
      {/* Garis tepi lapangan — bisa disembunyikan kalau garis aslinya sudah ada */}
      {garis === 1 && (
        <>
          <rect
            data-lap="tepi"
            x={0}
            y={0}
            width={VW}
            height={VH}
            fill="none"
            stroke="rgba(255,255,255,0.8)"
            strokeWidth={0.3}
          />
          <rect
            x={playStart}
            y={0}
            width={f.lengthYd}
            height={VH}
            fill="none"
            stroke="rgba(255,255,255,0.5)"
            strokeWidth={0.2}
          />
        </>
      )}

      {/* DD1 — Garis & label patok terpisah — tidak memotong grid */}
      {patokAktif && (patokGarisOn || patokLabelOn) && (
        <g data-lap="patok">
          {/* Garis patok — dapat dimatikan tanpa menghilangkan grid atau label */}
          {patokGarisOn && (
            <>
              {patokX.map((g) => (
                <line
                  key={`px-${g.pos}`}
                  x1={sx(g.pos)}
                  y1={0}
                  x2={sx(g.pos)}
                  y2={VH}
                  stroke="rgba(255,255,255,0.28)"
                  strokeWidth={0.12}
                  strokeDasharray="0.7 1.3"
                />
              ))}
              {patokY.map((g) => (
                <line
                  key={`py-${g.pos}`}
                  x1={0}
                  y1={sy(g.pos)}
                  x2={VW}
                  y2={sy(g.pos)}
                  stroke="rgba(255,255,255,0.28)"
                  strokeWidth={0.12}
                  strokeDasharray="0.7 1.3"
                />
              ))}
            </>
          )}
          {/* Label patok — dapat dimatikan terpisah dari garis */}
          {patokLabelOn && (
            <>
              {patokX.map((g) => (
                <text
                  key={`tx-${g.pos}`}
                  x={sx(g.pos)}
                  y={VH - 0.35}
                  textAnchor="middle"
                  fontSize={1.7}
                  fill="rgba(255,255,255,0.75)"
                  style={{ fontWeight: 600 }}
                >
                  {g.label}
                </text>
              ))}
              {patokY.map((g) => (
                <text
                  key={`ty-${g.pos}`}
                  x={0.7}
                  y={sy(g.pos) + 0.55}
                  textAnchor="start"
                  fontSize={1.7}
                  fill="rgba(255,255,255,0.75)"
                  style={{ fontWeight: 600 }}
                >
                  {g.label}
                </text>
              ))}
            </>
          )}
        </g>
      )}

      {/* Label yard */}
      {f.showLabels === 1 && !patokAktif &&
        yardLines
          .filter((y) => Math.abs(y) % 10 === 0)
          .map((y) => (
            <g key={`lbl-${y}`}>
              <text
                x={sx(y)}
                y={2.6}
                textAnchor="middle"
                fontSize={2.2}
                data-lap="teks"
                fill="rgba(255,255,255,0.85)"
                style={{ fontWeight: 600 }}
              >
                {yardValue(y)}
              </text>
              <text
                x={sx(y)}
                y={VH - 0.9}
                textAnchor="middle"
                fontSize={2.2}
                data-lap="teks"
                fill="rgba(255,255,255,0.85)"
                style={{ fontWeight: 600 }}
              >
                {yardValue(y)}
              </text>
            </g>
          ))}

      {/* Keterangan sisi — S1/S2 hanya dipakai lapangan football */}
      {!patokAktif && (
        <>
          <text data-lap="teks" x={1.2} y={VH / 2 - 1.5} fontSize={2} fill="rgba(255,255,255,0.6)">
            S1
          </text>
          <text
            data-lap="teks"
            x={VW - 1.2}
            y={VH / 2 - 1.5}
            fontSize={2}
            fill="rgba(255,255,255,0.6)"
            textAnchor="end"
          >
            S2
          </text>
        </>
      )}
      {/* Arah penonton — perlu di semua jenis lapangan, termasuk yang memakai patok */}
      <text data-lap="teks" x={VW / 2} y={VH - 0.8} fontSize={1.8} fill="rgba(255,255,255,0.5)" textAnchor="middle">
        FRONT (penonton)
      </text>
      <text data-lap="teks" x={VW / 2} y={1.2} fontSize={1.6} fill="rgba(255,255,255,0.45)" textAnchor="middle">
        BACK
      </text>
    </g>
  )
}
