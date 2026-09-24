/**
 * Diekstrak dari `src/pages/Drill.tsx` (#5 — pecah Drill.tsx).
 * Isinya tidak diubah; hanya alamat impor yang disesuaikan.
 */

/** DD2 — Jejak gerak & tapak langkah di kanvas editor. */

import {
  deltaBusur,
  kendaliJalur,
  pathBusur,
  titikJalur,
} from '../lib/gerak'

/* ========================================================================== */
/*  DD2 — Jejak gerak                                                         */
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
 * Satu jejak perpindahan pemain: garis lurus, atau **kurva** kalau set-nya
 * memakai jalur melengkung. Jejak "masuk" memakai pengaturan set sebelumnya,
 * jejak "keluar" memakai pengaturan set yang aktif.
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
}) {
  const atribut = {
    stroke: warna,
    strokeOpacity: opacity,
    strokeWidth: 0.22,
    fill: 'none',
    markerEnd: panah,
  }
  // DD4 — busur putaran digambar dari titik awal, mengikuti putaran yang sama
  // dengan animasi (bukan perintah `A`, supaya keduanya tidak mungkin beda).
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
 * DD9 — Tapak langkah.
 *
 * Tanda kecil di sepanjang jejak, **satu tiap satu langkah**, jadi pelatih bisa
 * melihat langsung berapa kali pemain melangkah dan di mana kaki mendarat.
 * Jarak antar tapak mengikuti mode langkah (DD10b): mode `menyesuaikan`
 * menaruh tapak sesuai hitungan, mode `tetap` sesuai ukuran langkah.
 *
 * Sengaja cuma digambar untuk pemain yang dipilih — kalau digambar untuk
 * seisi formasi, papan akan penuh oleh tapak dan justru tidak terbaca.
 */
export function TapakLangkah({
  x1,
  y1,
  x2,
  y2,
  lengkung,
  busur,
  jumlah,
  warna,
}: {
  x1: number
  y1: number
  x2: number
  y2: number
  lengkung: number
  busur?: BusurGambar
  jumlah: number
  warna: string
}) {
  if (jumlah < 2) return null
  const titik: { k: number; x: number; y: number }[] = []
  for (let k = 1; k < jumlah; k++) {
    const t = k / jumlah
    const [dx, dy] = busur
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

/* ========================================================================== */
/*  Halaman utama                                                              */
/* ========================================================================== */
