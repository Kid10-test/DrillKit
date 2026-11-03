/**
 * Diekstrak dari `src/pages/Drill.tsx` (#5 — pecah Drill.tsx).
 * Diperkaya pada #23.1 & #23.2 untuk mendukung rantai titik singgah (Midsets)
 * serta bentuk geometri titik berbasis Tag lintas-seksi (#hex murni).
 */

/** DD2, #23.1, & #23.2 — Jejak gerak, tapak langkah, & bentuk titik di kanvas. */

import type { BentukTitikTag, TitikSinggahMidset } from '../db/types'
import {
  deltaBusur,
  deltaMidsets,
  kendaliJalur,
  pathBusur,
  pathSvgMidsets,
  titikJalur,
} from '../lib/gerak'
import { poligonBentukTitik } from '../lib/tagAnggota'

/* ========================================================================== */
/*  DD2 & #23.1 — Jejak gerak                                                 */
/* ========================================================================== */

/**
 * DD4 + putar-jalan — busur putaran, dalam **ruang gambar**.
 *
 * `geser` membuat lingkarannya ikut berjalan: pusat putaran bergeser sejauh
 * `geser` selama perpindahan, sementara blok berputar mengitari pusat yang
 * sedang berpindah itu. Kosong atau nol = berputar di tempat (perilaku lama).
 */
export type BusurGambar = {
  pusat: { x: number; y: number }
  sudut: number
  geser?: { x: number; y: number }
}

/**
 * Satu jejak perpindahan pemain: garis lurus, kurva, busur putaran, atau rantai
 * multi-segmen `midsets` (#23.1).
 */
export function Jejak({
  nama,
  x1,
  y1,
  x2,
  y2,
  lengkung,
  warna,
  opacity,
  putus,
  panah,
  busur,
  midsetsSvg,
  countsSet,
}: {
  nama: string
  x1: number
  y1: number
  x2: number
  y2: number
  lengkung: number
  warna: string
  opacity: number
  putus?: string
  panah?: string
  /** DD4 — busur putaran: dipakai kalau pemain ini mengikuti putaran blok. */
  busur?: BusurGambar
  /** #23.1 — titik singgah dalam ruang gambar SVG (bila pemain memiliki midsets). */
  midsetsSvg?: TitikSinggahMidset[]
  countsSet?: number
}) {
  const atribut = {
    stroke: warna,
    strokeOpacity: opacity,
    strokeWidth: 0.22,
    fill: 'none',
    markerEnd: panah,
  }
  if (midsetsSvg?.length) {
    return (
      <path
        data-trail={nama}
        data-midset-trail="1"
        d={pathSvgMidsets({ x: x1, y: y1 }, { x: x2, y: y2 }, midsetsSvg, countsSet ?? 8, lengkung)}
        strokeDasharray={putus}
        {...atribut}
      />
    )
  }
  if (busur) {
    return (
      <path
        data-trail={nama}
        d={pathBusur(x1, y1, busur.pusat, busur.sudut, 24, busur.geser ?? { x: 0, y: 0 })}
        strokeDasharray={putus}
        {...atribut}
      />
    )
  }
  if (!lengkung) {
    return <line data-trail={nama} x1={x1} y1={y1} x2={x2} y2={y2} strokeDasharray={putus} {...atribut} />
  }
  const [cx, cy] = kendaliJalur(x2 - x1, y2 - y1, lengkung)
  return (
    <path
      data-trail={nama}
      d={`M ${x1} ${y1} Q ${x1 + cx} ${y1 + cy} ${x2} ${y2}`}
      strokeDasharray={putus}
      {...atribut}
    />
  )
}

/**
 * DD9 & #23.1 — Tapak langkah di sepanjang jejak (termasuk melewati rantai `midsets`).
 */
export function TapakLangkah({
  x1,
  y1,
  x2,
  y2,
  lengkung,
  busur,
  midsetsSvg,
  countsSet,
  jumlah,
  warna,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  lengkung: number
  busur?: BusurGambar
  midsetsSvg?: TitikSinggahMidset[]
  countsSet?: number
  jumlah: number
  warna: string
}) {
  if (jumlah < 2) return null
  const titik: { k: number; x: number; y: number }[] = []
  for (let k = 1; k < jumlah; k++) {
    const t = k / jumlah
    const [dx, dy] = midsetsSvg?.length
      ? deltaMidsets({ x: x1, y: y1 }, { x: x2, y: y2 }, midsetsSvg, countsSet ?? 8, t, lengkung)
      : busur
        ? deltaBusur(t, x1, y1, busur.pusat, busur.sudut, busur.geser ?? { x: 0, y: 0 })
        : titikJalur(t, x2 - x1, y2 - y1, lengkung)
    titik.push({ k, x: x1 + dx, y: y1 + dy })
  }
  return (
    <g data-tapak="1" style={{ pointerEvents: 'none' }}>
      {titik.map((t) => (
        <circle key={t.k} cx={t.x} cy={t.y} r={0.4} fill={warna} fillOpacity={0.85} />
      ))}
    </g>
  )
}

/**
 * #23.2 — Penggambar titik pemain berbasis bentuk (`bulat`, `kotak`, `intan`, `segitiga`)
 * dengan warna `#hex` murni.
 *
 * Selalu menyertakan jangkar `<circle data-titik="1" cx cy>` agar pembaca koordinat DOM
 * dan uji regresi lama bekerja seragam pada bentuk geometri apa pun.
 */
export function TitikPemainBentuk({
  cx,
  cy,
  r,
  bentuk = 'bulat',
  fill,
  stroke,
  strokeWidth,
}: {
  cx: number
  cy: number
  r: number
  bentuk?: BentukTitikTag
  fill: string
  stroke: string
  strokeWidth: number
}) {
  if (bentuk === 'bulat') {
    return (
      <circle
        data-titik="1"
        data-bentuk-titik="bulat"
        cx={cx}
        cy={cy}
        r={r}
        fill={fill}
        stroke={stroke}
        strokeWidth={strokeWidth}
      />
    )
  }
  const sKotak = r * 1.82
  return (
    <>
      <circle
        data-titik="1"
        data-bentuk-titik={bentuk}
        cx={cx}
        cy={cy}
        r={r}
        fill={fill}
        fillOpacity={0}
        stroke="none"
      />
      {bentuk === 'kotak' ? (
        <rect
          data-bentuk-geometri="kotak"
          x={cx - sKotak / 2}
          y={cy - sKotak / 2}
          width={sKotak}
          height={sKotak}
          rx={r * 0.18}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      ) : (
        <polygon
          data-bentuk-geometri={bentuk}
          points={poligonBentukTitik(bentuk, cx, cy, r)}
          fill={fill}
          stroke={stroke}
          strokeWidth={strokeWidth}
        />
      )}
    </>
  )
}
