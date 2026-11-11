import type { FieldConfig } from '../db/types'
import {
  HASH_OFFSET_YD,
  M_TO_YD,
  YD_TO_M,
  apakahModeParade,
  garisLapangan,
  gridUtamaTampil,
  hashGarisTampil,
  paradeOf,
  patokOf,
  skalaGarisLapangan,
  warnaGarisGrid,
  type GarisLapangan,
  warnaLapangan,
} from '../lib/field'

/**
 * Gambar lapangan (rumput, end zone, garis lapangan, hash mark, dan label).
 *
 * v2.9 — hanya ada **satu set garis** (`garisLapangan`): bila patok aktif,
 * garisnya adalah patok itu sendiri (huruf, #, T); bila tidak, garis yard
 * tiap 5 yard. Label `A B C` / `50 45 40` hanyalah nama garis yang sama.
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
  balik = false,
}: {
  f: FieldConfig
  VW: number
  VH: number
  sx: (n: number) => number
  sy: (n: number) => number
  /** Bila `true`, memakai atribut `data-pratinjau-lap` agar tidak bentrok dengan kanvas utama. */
  pratinjau?: boolean
  /**
   * #26 — perspektif pemain 180°: pemanggil memakai `sx`/`sy` terbalik, dan
   * label tetap (S1/S2, FRONT/BACK) ikut ditukar supaya terbaca benar.
   */
  balik?: boolean
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
  const showGrid = gridUtamaTampil(f) && garis !== 0
  const showHash = hashGarisTampil(f) && garis !== 0 && f.hash !== 'none'
  const showLabel = f.showLabels === 1
  const grid = garisLapangan(f)
  /** Garis bantu 1 langkah tetap tampil walau garis utama disembunyikan (asal garis lapangan tidak 0). */
  const bantuX = garis !== 0 ? grid.x.filter((g) => g.jenis === 'langkah') : []
  const bantuY = garis !== 0 ? grid.y.filter((g) => g.jenis === 'langkah') : []
  const utamaX = showGrid ? grid.x.filter((g) => g.jenis !== 'langkah') : []
  const utamaY = showGrid ? grid.y.filter((g) => g.jenis !== 'langkah') : []
  /** Label patok selalu di garisnya; label yard football tiap 10 yard seperti lapangan sungguhan. */
  const labelXSemua = showLabel
    ? grid.x.filter((g) => g.label !== undefined && (patokAktif || Math.abs(Math.abs(g.pos) % 10) < 1e-6))
    : []
  // Label patok huruf terlalu rapat (mis. lapangan bola 105 m) → tulis huruf saja, garis # tetap digambar.
  const jarakLabelMin = labelXSemua
    .map((g) => g.pos)
    .sort((a, b) => a - b)
    .reduce((m, v, i, arr) => (i ? Math.min(m, v - arr[i - 1]) : m), Infinity)
  const labelX =
    patokAktif && jarakLabelMin < 3.4 ? labelXSemua.filter((g) => !g.label?.includes('#')) : labelXSemua
  const labelY = showLabel && patokAktif ? grid.y.filter((g) => g.label !== undefined) : []
  const gayaGaris = (g: GarisLapangan) =>
    g.jenis === 'tengah'
      ? { strokeOpacity: 0.4, strokeWidth: 0.13 * skalaG, strokeDasharray: `${0.9 * skalaG} ${0.7 * skalaG}` }
      : { strokeOpacity: g.tengah ? 0.72 : 0.55, strokeWidth: (g.tengah ? 0.35 : 0.18) * skalaG }

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
      {/* v2.9 — garis bantu tiap 1 langkah (paling tipis, di bawah garis utama) */}
      {bantuX.map((g) => (
        <line
          key={`bx-${g.pos}`}
          x1={sx(g.pos)}
          y1={0}
          x2={sx(g.pos)}
          y2={VH}
          {...tagLap('subgrid')}
          stroke={hexGaris}
          strokeOpacity={0.16}
          strokeWidth={0.06 * skalaG}
        />
      ))}
      {bantuY.map((g) => (
        <line
          key={`by-${g.pos}`}
          x1={0}
          y1={sy(g.pos)}
          x2={VW}
          y2={sy(g.pos)}
          {...tagLap('subgrid')}
          stroke={hexGaris}
          strokeOpacity={0.16}
          strokeWidth={0.06 * skalaG}
        />
      ))}
      {/* v2.9 — satu set garis lapangan: patok (huruf, #, T) atau garis yard */}
      {utamaX.map((g) => (
        <line
          key={`gx-${g.pos}`}
          x1={sx(g.pos)}
          y1={0}
          x2={sx(g.pos)}
          y2={VH}
          {...tagLap(g.jenis === 'tengah' ? 'garis-tengah' : 'garis')}
          data-label-garis={g.label}
          stroke={hexGaris}
          {...gayaGaris(g)}
        />
      ))}
      {utamaY.map((g) => (
        <line
          key={`gy-${g.pos}`}
          x1={0}
          y1={sy(g.pos)}
          x2={VW}
          y2={sy(g.pos)}
          {...tagLap('garis')}
          data-label-garis={g.label}
          stroke={hexGaris}
          {...gayaGaris(g)}
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

      {/* Label garis — patok: huruf di tepi depan & T di tepi kiri; football: angka yard atas & bawah */}
      {patokAktif && labelX.length + labelY.length > 0 && (
        <g {...tagLap('patok')}>
          {labelX.map((g) => (
            <text
              key={`tx-${g.pos}`}
              x={sx(g.pos)}
              y={balik ? 1.6 : VH - 0.35}
              textAnchor="middle"
              fontSize={1.7}
              fill="#ffffff"
              fillOpacity={0.78}
              style={{ fontWeight: 600 }}
            >
              {g.label}
            </text>
          ))}
          {labelY.map((g) => (
            <text
              key={`ty-${g.pos}`}
              x={0.7}
              y={Math.min(VH - 2.3, Math.max(3.4, sy(g.pos) + 0.55))}
              textAnchor="start"
              fontSize={1.7}
              fill="#ffffff"
              fillOpacity={0.78}
              style={{ fontWeight: 600 }}
            >
              {g.label}
            </text>
          ))}
        </g>
      )}
      {!patokAktif &&
        labelX.map((g) => (
          <g key={`lbl-${g.pos}`}>
            <text
              x={sx(g.pos)}
              y={2.6}
              textAnchor="middle"
              fontSize={2.2}
              {...tagLap('teks')}
              fill={hexGaris}
              fillOpacity={0.85}
              style={{ fontWeight: 600 }}
            >
              {g.label}
            </text>
            <text
              x={sx(g.pos)}
              y={VH - 0.9}
              textAnchor="middle"
              fontSize={2.2}
              {...tagLap('teks')}
              fill={hexGaris}
              fillOpacity={0.85}
              style={{ fontWeight: 600 }}
            >
              {g.label}
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
            {balik ? 'S2' : 'S1'}
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
            {balik ? 'S1' : 'S2'}
          </text>
        </>
      )}
      {/* Arah penonton — pada Mode Parade ukurannya mengikuti lebar jalan agar tidak menabrak marka */}
      <text
        {...tagLap('teks')}
        x={modeParade ? 1.5 : VW / 2}
        y={balik ? (patokAktif ? 3.4 : 1.2) : VH - (modeParade ? 0.35 * skalaTeksParade : patokAktif ? 2.6 : 0.8)}
        fontSize={modeParade ? 1.2 * skalaTeksParade : 1.8}
        fill="#ffffff"
        fillOpacity={0.5}
        textAnchor={modeParade ? 'start' : 'middle'}
      >
        {modeParade ? 'TEPI DEPAN (PENONTON)' : balik ? 'PENONTON (front)' : 'FRONT (penonton)'}
      </text>
      <text
        {...tagLap('teks')}
        x={modeParade ? 1.5 : VW / 2}
        y={balik ? VH - (patokAktif ? 2.6 : 0.8) : modeParade ? 0.9 * skalaTeksParade : 1.2}
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
