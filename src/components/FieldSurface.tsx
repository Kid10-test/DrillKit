import type { FieldConfig } from '../db/types'
import {
  HASH_OFFSET_YD,
  daftarPatok,
  garisGridUtama,
  garisSubgrid,
  gridUtamaTampil,
  hashGarisTampil,
  patokGarisTampil,
  patokLabelTampil,
  patokOf,
  skalaGarisLapangan,
  subgridTampil,
  warnaGarisGrid,
  warnaLapangan,
} from '../lib/field'

/**
 * Gambar lapangan (rumput, end zone, garis yard/grid kustom, subgrid, hash mark,
 * patok, dan label yard).
 *
 * Sengaja dipisah dari halaman Drill supaya bisa dipakai ulang oleh tampilan
 * lain yang juga butuh gambar lapangan — mode presenter, halaman anggota/kios,
 * bagan cetak, serta pratinjau langsung di `FieldConfigEditor`.
 *
 * Semua warna memakai **hex murni** (`#rrggbb` + `strokeOpacity`/`fillOpacity`,
 * tanpa `oklch()`/`color-mix()`/`rgba()`) agar aman di cetak A4 dan bundel portabel.
 */
export function FieldSurface({
  f,
  VW,
  VH,
  sx,
  sy,
  pratinjau = false,
}: {
  f: FieldConfig
  VW: number
  VH: number
  sx: (n: number) => number
  sy: (n: number) => number
  /** Bila `true`, memakai atribut `data-pratinjau-lap` agar tidak bentrok dengan kanvas utama. */
  pratinjau?: boolean
}) {
  const tagLap = (jenis: string) =>
    pratinjau ? { 'data-pratinjau-lap': jenis } : { 'data-lap': jenis }

  const playStart = f.endZoneYd // svg x awal area main
  const playEnd = f.endZoneYd + f.lengthYd
  /** DD1 — kalau tim memakai patok, garis & label lapangan mengikuti patok. */
  const pCfg = patokOf(f)
  const patokAktif = pCfg.aktif === 1
  /** Warna latar, warna garis hex, & skala ketebalan garis mengikuti lapangan. */
  const warna = warnaLapangan(f)
  const hexGaris = warnaGarisGrid(f).hex
  const skalaG = skalaGarisLapangan(f)
  /** 1 = semua garis, 2 = tanpa garis tepi, 0 = semua disembunyikan. */
  const garis = f.garis ?? 1
  const patokGarisOn = patokAktif && patokGarisTampil(pCfg)
  const patokLabelOn = patokAktif && patokLabelTampil(pCfg)
  const patokX = patokAktif ? daftarPatok(f, 'x') : []
  const patokY = patokAktif ? daftarPatok(f, 'y') : []

  const showGridUtama = gridUtamaTampil(f) && garis !== 0
  const showSubgrid =
    subgridTampil(f) && garis !== 0 && !!f.subgridYd && f.subgridYd > 0 && f.subgridYd < f.gridYd
  const showHash = hashGarisTampil(f) && garis !== 0 && f.hash !== 'none'

  const yardLines = showGridUtama ? garisGridUtama(f) : []
  const subLines = showSubgrid ? garisSubgrid(f) : []

  const yardValue = (y: number) => 50 - Math.abs(Math.round(y))
  const offsetHash = HASH_OFFSET_YD[f.hash] ?? 0

  return (
    <g>
      {/* Rumput */}
      <rect {...tagLap('rumput')} x={0} y={0} width={VW} height={VH} fill={warna.rumput} />
      {/* End zone */}
      {f.endZoneYd > 0 && (
        <>
          <rect {...tagLap('zona')} x={0} y={0} width={f.endZoneYd} height={VH} fill={warna.zona} />
          <rect
            {...tagLap('zona')}
            x={playEnd}
            y={0}
            width={f.endZoneYd}
            height={VH}
            fill={warna.zona}
          />
        </>
      )}
      {/* Garis grid utama */}
      {showGridUtama &&
        yardLines.map((y) => (
          <line
            key={`yl-${y}`}
            x1={sx(y)}
            y1={0}
            x2={sx(y)}
            y2={VH}
            {...tagLap('garis')}
            stroke={hexGaris}
            strokeOpacity={y === 0 ? 0.72 : 0.55}
            strokeWidth={(y === 0 ? 0.35 : 0.18) * skalaG}
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
            {...tagLap('subgrid')}
            stroke={hexGaris}
            strokeOpacity={0.22}
            strokeWidth={0.1 * skalaG}
          />
        ))}
      {/* Hash marks — terpisah dari grid utama */}
      {showHash && offsetHash > 0 && (
        <>
          {([-1, 1] as const).map((sgn) => {
            const offset = offsetHash * sgn
            return (
              <line
                key={`hash-${sgn}`}
                x1={playStart}
                y1={sy(offset)}
                x2={playEnd}
                y2={sy(offset)}
                {...tagLap('hash')}
                stroke={hexGaris}
                strokeOpacity={0.42}
                strokeWidth={0.18 * skalaG}
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
            {...tagLap('tepi')}
            x={0}
            y={0}
            width={VW}
            height={VH}
            fill="none"
            stroke={hexGaris}
            strokeOpacity={0.8}
            strokeWidth={0.3 * skalaG}
          />
          <rect
            x={playStart}
            y={0}
            width={f.lengthYd}
            height={VH}
            fill="none"
            stroke={hexGaris}
            strokeOpacity={0.5}
            strokeWidth={0.2 * skalaG}
          />
        </>
      )}

      {/* DD1 — Garis & label patok terpisah — tidak memotong grid */}
      {patokAktif && (patokGarisOn || patokLabelOn) && (
        <g {...tagLap('patok')}>
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
                  stroke="#ffffff"
                  strokeOpacity={0.28}
                  strokeWidth={0.12 * skalaG}
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
                  stroke="#ffffff"
                  strokeOpacity={0.28}
                  strokeWidth={0.12 * skalaG}
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
                  fill="#ffffff"
                  fillOpacity={0.78}
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
                  fill="#ffffff"
                  fillOpacity={0.78}
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
      {f.showLabels === 1 &&
        !patokAktif &&
        yardLines
          .filter((y) => Math.abs(Math.abs(y) % 10) < 1e-6)
          .map((y) => (
            <g key={`lbl-${y}`}>
              <text
                x={sx(y)}
                y={2.6}
                textAnchor="middle"
                fontSize={2.2}
                {...tagLap('teks')}
                fill={hexGaris}
                fillOpacity={0.85}
                style={{ fontWeight: 600 }}
              >
                {yardValue(y)}
              </text>
              <text
                x={sx(y)}
                y={VH - 0.9}
                textAnchor="middle"
                fontSize={2.2}
                {...tagLap('teks')}
                fill={hexGaris}
                fillOpacity={0.85}
                style={{ fontWeight: 600 }}
              >
                {yardValue(y)}
              </text>
            </g>
          ))}

      {/* Keterangan sisi — S1/S2 hanya dipakai lapangan football */}
      {!patokAktif && (
        <>
          <text
            {...tagLap('teks')}
            x={1.2}
            y={VH / 2 - 1.5}
            fontSize={2}
            fill="#ffffff"
            fillOpacity={0.6}
          >
            S1
          </text>
          <text
            {...tagLap('teks')}
            x={VW - 1.2}
            y={VH / 2 - 1.5}
            fontSize={2}
            fill="#ffffff"
            fillOpacity={0.6}
            textAnchor="end"
          >
            S2
          </text>
        </>
      )}
      {/* Arah penonton — perlu di semua jenis lapangan, termasuk yang memakai patok */}
      <text
        {...tagLap('teks')}
        x={VW / 2}
        y={VH - 0.8}
        fontSize={1.8}
        fill="#ffffff"
        fillOpacity={0.5}
        textAnchor="middle"
      >
        FRONT (penonton)
      </text>
      <text
        {...tagLap('teks')}
        x={VW / 2}
        y={1.2}
        fontSize={1.6}
        fill="#ffffff"
        fillOpacity={0.45}
        textAnchor="middle"
      >
        BACK
      </text>
    </g>
  )
}
