import type { FieldConfig } from '../db/types'
import {
  HASH_OFFSET_YD,
  M_TO_YD,
  YD_TO_M,
  apakahModeParade,
  daftarPatok,
  garisGridUtama,
  garisSubgrid,
  gridUtamaTampil,
  hashGarisTampil,
  paradeOf,
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
  const modeParade = apakahModeParade(f)
  const prd = paradeOf(f)
  const skalaTeksParade = Math.min(1, Math.max(0.38, VH / 22))
  const bahuYd = modeParade ? Math.min(VH * 0.35, Math.max(0, prd.bahuJalanM * M_TO_YD)) : 0
  const tandaMajuParade = prd.arahDefile === 'kanan-ke-kiri' ? 1 : -1

  // Zona Panggung Kehormatan / Tribun VIP dalam koordinat SVG X (0..VW)
  const tengahVipXInternal = prd.posisiPanggungM * M_TO_YD * tandaMajuParade
  const setengahVipYd = (prd.panjangPanggungM * M_TO_YD) / 2
  const vipSvgKiri = Math.max(0, Math.min(VW, sx(tengahVipXInternal + setengahVipYd)))
  const vipSvgKanan = Math.max(0, Math.min(VW, sx(tengahVipXInternal - setengahVipYd)))
  const vipSvgX = Math.min(vipSvgKiri, vipSvgKanan)
  const vipSvgLebar = Math.max(0, Math.abs(vipSvgKanan - vipSvgKiri))

  // Penanda jarak meter tiap 10 m untuk Mode Kirab / Street Parade
  const penandaMeterParade: { xInternal: number; label: string }[] = []
  if (modeParade) {
    const setengahPanjangM = (f.lengthYd * YD_TO_M) / 2
    const batas10 = Math.floor((setengahPanjangM - 1) / 10) * 10
    for (let m = -batas10; m <= batas10; m += 10) {
      const xInt = m * M_TO_YD * tandaMajuParade
      const lbl = m === 0 ? '0 m' : `${m > 0 ? '+' : '−'}${Math.abs(m)} m`
      penandaMeterParade.push({ xInternal: xInt, label: lbl })
    }
  }

  return (
    <g>
      {/* Rumput / Aspal */}
      <rect {...tagLap('rumput')} x={0} y={0} width={VW} height={VH} fill={warna.rumput} />
      {/* #19 — Bahu jalan, marka as jalan, & Zona Panggung Kehormatan pada Mode Kirab */}
      {modeParade && (
        <g {...tagLap('parade-koridor')}>
          {bahuYd > 0 && (
            <>
              <rect
                {...tagLap('bahu-jalan')}
                x={0}
                y={0}
                width={VW}
                height={bahuYd}
                fill={warna.zona}
                fillOpacity={0.75}
              />
              <rect
                {...tagLap('bahu-jalan')}
                x={0}
                y={VH - bahuYd}
                width={VW}
                height={bahuYd}
                fill={warna.zona}
                fillOpacity={0.75}
              />
              {garis !== 0 && (
                <>
                  <line
                    x1={0}
                    y1={bahuYd}
                    x2={VW}
                    y2={bahuYd}
                    stroke="#f8fafc"
                    strokeOpacity={0.82}
                    strokeWidth={0.18 * skalaG}
                  />
                  <line
                    x1={0}
                    y1={VH - bahuYd}
                    x2={VW}
                    y2={VH - bahuYd}
                    stroke="#f8fafc"
                    strokeOpacity={0.82}
                    strokeWidth={0.18 * skalaG}
                  />
                </>
              )}
            </>
          )}
          {prd.markaTengah === 1 && garis !== 0 && (
            <line
              {...tagLap('marka-tengah')}
              x1={0}
              y1={sy(0)}
              x2={VW}
              y2={sy(0)}
              stroke="#fde047"
              strokeOpacity={0.72}
              strokeWidth={0.2 * skalaG}
              strokeDasharray={`${1.6 * skalaG} ${1.3 * skalaG}`}
            />
          )}
          {prd.panggungAktif === 1 && vipSvgLebar > 0.2 && (
            <g {...tagLap('panggung-vip')}>
              <rect
                x={vipSvgX}
                y={bahuYd}
                width={vipSvgLebar}
                height={Math.max(0, VH - bahuYd * 2)}
                fill="#f59e0b"
                fillOpacity={0.14}
              />
              <line
                x1={vipSvgX}
                y1={0}
                x2={vipSvgX}
                y2={VH}
                stroke="#fbbf24"
                strokeOpacity={0.85}
                strokeWidth={0.22 * skalaG}
                strokeDasharray={`${0.8 * skalaG} ${0.6 * skalaG}`}
              />
              <line
                x1={vipSvgX + vipSvgLebar}
                y1={0}
                x2={vipSvgX + vipSvgLebar}
                y2={VH}
                stroke="#fbbf24"
                strokeOpacity={0.85}
                strokeWidth={0.22 * skalaG}
                strokeDasharray={`${0.8 * skalaG} ${0.6 * skalaG}`}
              />
              <rect
                x={vipSvgX}
                y={prd.sisiPanggung === 'belakang' ? 0 : Math.max(0, VH - Math.max(bahuYd, 1.1 * skalaTeksParade))}
                width={vipSvgLebar}
                height={Math.max(bahuYd, 1.1 * skalaTeksParade)}
                fill="#b45309"
                fillOpacity={0.92}
              />
              <text
                x={vipSvgX + vipSvgLebar / 2}
                y={
                  prd.sisiPanggung === 'belakang'
                    ? Math.max(bahuYd, 1.1 * skalaTeksParade) * 0.74
                    : VH - Math.max(bahuYd, 1.1 * skalaTeksParade) * 0.26
                }
                textAnchor="middle"
                fontSize={1.35 * skalaTeksParade}
                fill="#fef3c7"
                style={{ fontWeight: 700, letterSpacing: '0.03em' }}
              >
                {prd.labelPanggung}
              </text>
            </g>
          )}
          <text
            {...tagLap('arah-defile')}
            x={prd.arahDefile === 'kanan-ke-kiri' ? VW - 1.5 : 1.5}
            y={VH / 2 - 0.55 * skalaTeksParade}
            textAnchor={prd.arahDefile === 'kanan-ke-kiri' ? 'end' : 'start'}
            fontSize={1.45 * skalaTeksParade}
            fill="#e2e8f0"
            fillOpacity={0.62}
            style={{ fontWeight: 700 }}
          >
            {prd.arahDefile === 'kanan-ke-kiri' ? '← ARAH DEFILE' : 'ARAH DEFILE →'}
          </text>
          {penandaMeterParade.map((pm) => (
            <text
              key={`pm-${pm.label}`}
              x={sx(pm.xInternal)}
              y={bahuYd + 1.15 * skalaTeksParade}
              textAnchor="middle"
              fontSize={1.25 * skalaTeksParade}
              fill="#cbd5e1"
              fillOpacity={0.72}
              style={{ fontWeight: 600 }}
            >
              {pm.label}
            </text>
          ))}
        </g>
      )}
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
      {!patokAktif && !modeParade && (
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
      {/* Arah penonton — pada Mode Parade ukurannya mengikuti lebar jalan agar tidak menabrak marka */}
      <text
        {...tagLap('teks')}
        x={modeParade ? 1.5 : VW / 2}
        y={VH - (modeParade ? 0.35 * skalaTeksParade : 0.8)}
        fontSize={modeParade ? 1.2 * skalaTeksParade : 1.8}
        fill="#ffffff"
        fillOpacity={0.5}
        textAnchor={modeParade ? 'start' : 'middle'}
      >
        {modeParade ? 'TEPI DEPAN (PENONTON)' : 'FRONT (penonton)'}
      </text>
      <text
        {...tagLap('teks')}
        x={modeParade ? 1.5 : VW / 2}
        y={modeParade ? 0.9 * skalaTeksParade : 1.2}
        fontSize={modeParade ? 1.15 * skalaTeksParade : 1.6}
        fill="#ffffff"
        fillOpacity={0.45}
        textAnchor={modeParade ? 'start' : 'middle'}
      >
        {modeParade ? 'TEPI BELAKANG' : 'BACK'}
      </text>
    </g>
  )
}
