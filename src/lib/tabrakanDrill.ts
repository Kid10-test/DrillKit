/**
 * #24 (`v2.2.2`) — Pemeriksa Tabrakan Lintasan, Kerataan Interval, & Penyelesai Silang 1-Klik.
 *
 * Seluruh perhitungan ditulis 100% clean-room dalam TypeScript murni tanpa akses DOM/Dexie:
 *  1. Detektor benturan lintasan waktu-nyata tiap `0,25` hitungan berbasis Spatial Hash Grid
 *     (`O(N)` per sampel) yang mengikuti seluruh jenis lintasan DrillKit (`FTL`, `Midsets` #23,
 *     jalur sub-kelompok, busur putar, jalur lengkung, `Move+Hold`, `Ripple`, serta kotak
 *     berputar `Moving Props` #16.4).
 *  2. Radius ruang aman sadar-instrumen (*Equipment Footprint*: Tuba/Sousaphone, Battery,
 *     Color Guard, Pit, & tiup standar) serta deteksi *Blind Back-March* (melangkah mundur
 *     cepat memotong jalur pemain lain).
 *  3. Pemeriksa kerataan spasi barisan (*Spacing Drift Linter*) untuk titik non-terikat +
 *     perata spasi 1-klik.
 *  4. Penyelesai jalur bersilang 1-klik (*2-Opt Assignment Uncrosser*) di dalam seksi yang sama.
 */

import type {
  BentukTerikat,
  DrillPoint,
  DrillSet,
  FieldMarker,
  Member,
} from '../db/types'
import { facingDeg } from './field'
import { buatPenjejakSet, posisiJalurPadaP, type JalurPemain } from './jejakJalur'
import { apakahPropertiBergerak, penandaEfektifPadaSet } from './propertiGerak'

/* ============================================================================
 * 1. Radius Ruang Aman Sadar-Instrumen & Arah Jalan Mundur
 * ========================================================================== */

export type KategoriRuangInstrumen = 'standar' | 'tuba' | 'perkusi' | 'guard' | 'pit'

export interface InfoRadiusInstrumen {
  kategori: KategoriRuangInstrumen
  /** Radius pribadi pemain dalam satuan langkah (mis. 0.48 -> jarak pasangan 0.96 langkah). */
  radiusLangkah: number
  /** Radius pribadi pemain dalam satuan yard. */
  radiusYd: number
  label: string
}

/**
 * Tentukan radius ruang aman pribadi seorang pemain menurut instrumen & seksinya.
 *
 * Catatan desain lapangan:
 *  - Tiup standar (`Trumpet`, `Mellophone`, `Woodwind`, `Baritone`): `0,48` langkah
 *    (jarak aman antar-dua pemain tiup saat berpapasan = `0,96` langkah; blok rapat
 *    `1,0` langkah tetap dianggap sah dan tidak memicu alarm palsu).
 *  - `Sousaphone / Tuba / Contra`: `0,72` langkah (butuh ruang tabung melingkar lebar).
 *  - `Battery / Perkusi` (`Snare`, `Tenor/Quint`, `Bass Drum`, `Cymbal`): `0,68` langkah
 *    (carrier & harness menonjol di depan badan).
 *  - `Color Guard` (`Flag` 6 kaki, `Rifle`, `Sabre`): `0,75` langkah (ayunan peralatan).
 *  - `Pit / Front Ensemble`: `0,70` langkah.
 */
export function radiusAmanInstrumen(
  anggota: Pick<Member, 'section' | 'instrument'> | undefined,
  stepYd: number,
): InfoRadiusInstrumen {
  const sYd = stepYd > 0 ? stepYd : 5 / 8
  const teks = `${anggota?.instrument ?? ''} ${anggota?.section ?? ''}`.toLowerCase()

  if (/\b(guard|colorguard|color guard|bendera|flag|rifle|sabre|saber)\b/.test(teks)) {
    return {
      kategori: 'guard',
      radiusLangkah: 0.75,
      radiusYd: 0.75 * sYd,
      label: 'Color Guard',
    }
  }
  if (/\b(tuba|sousa|sousaphone|contra|kontra)\b/.test(teks)) {
    return {
      kategori: 'tuba',
      radiusLangkah: 0.72,
      radiusYd: 0.72 * sYd,
      label: 'Tuba / Sousaphone',
    }
  }
  if (/\b(pit|front ensemble|marimba|vibraphone|vibra|xylophone|mallet|synth|timpani)\b/.test(teks)) {
    return {
      kategori: 'pit',
      radiusLangkah: 0.7,
      radiusYd: 0.7 * sYd,
      label: 'Front Ensemble',
    }
  }
  if (/\b(battery|percussion|perkusi|drumline|snare|tenor|quint|quad|bass|cymbal|simbal)\b/.test(teks)) {
    return {
      kategori: 'perkusi',
      radiusLangkah: 0.68,
      radiusYd: 0.68 * sYd,
      label: 'Battery / Perkusi',
    }
  }
  return {
    kategori: 'standar',
    radiusLangkah: 0.48,
    radiusYd: 0.48 * sYd,
    label: 'Tiup Standar',
  }
}

/**
 * Uji apakah vektor kecepatan `(vxYd, vyYd)` berlawanan `> 120°` dengan arah hadap
 * badan/instrumen pemain (*blind back-march*).
 *
 * Konvensi sumbu internal DrillKit:
 *  - `+x` = ke arah Side 1 (kiri layar), `+y` = ke arah Back Sideline (atas layar).
 *  - `facingDeg('front') = 0°` menghadap penonton `(0, -1)` dalam ruang yard;
 *    `facingDeg('left') = 90°` menghadap Side 1 `(+1, 0)`;
 *    `facingDeg('back') = 180°` menghadap Back Sideline `(0, +1)`.
 */
export function apakahJalanMundur(
  vxYd: number,
  vyYd: number,
  facing: string | undefined,
  customDeg?: number,
  ambangGerakYd = 0.02,
): boolean {
  const laju = Math.hypot(vxYd, vyYd)
  if (laju < ambangGerakYd) return false
  const deg = facingDeg(facing || 'front', customDeg)
  const rad = (deg * Math.PI) / 180
  const hadapX = Math.sin(rad)
  const hadapY = -Math.cos(rad)
  const kosinus = (vxYd * hadapX + vyYd * hadapY) / laju
  return kosinus < -0.5 // sudut > 120° dari arah pandang mata
}

/* ============================================================================
 * 2. Pencuplik Lintasan & Pemeriksa Benturan Berbasis Spatial Hash Grid
 * ========================================================================== */

export type JenisBenturan = 'antar_pemain' | 'pemain_properti'
export type TingkatBenturan = 'tabrakan' | 'nyaris'

export interface KejadianTabrakan {
  id: string
  jenis: JenisBenturan
  tingkat: TingkatBenturan
  /** ID pemain pertama. */
  idA: string
  kodeA: string
  namaA: string
  seksiA: string
  /** ID pemain kedua (bila `antar_pemain`) atau ID `FieldMarker` (bila `pemain_properti`). */
  idB: string
  kodeB: string
  namaB: string
  seksiB?: string
  /** Hitungan saat jarak mencapai titik tersempit (dibulatkan ke 0,25 hitungan). */
  padaCount: number
  /** Rentang hitungan selama jarak berada di bawah batas aman. */
  countAwal: number
  countAkhir: number
  /** Jarak pusat-ke-pusat (atau pusat pemain ke tepi prop) tersempit dalam yard. */
  jarakYd: number
  /** Jarak tersempit dalam satuan langkah lapangan aktif. */
  jarakLangkah: number
  /** Batas jarak aman pasangan dalam satuan langkah. */
  batasAmanLangkah: number
  /** Lokasi tengah benturan dalam satuan yard lapangan (untuk cincin #hex di kanvas). */
  x: number
  y: number
  /** True bila salah satu pemain sedang melangkah mundur cepat (*blind back-march*). */
  jalanMundur: boolean
  /** Keterangan ringkas siap tampil di UI. */
  ringkasan: string
}

export interface HasilPemeriksaanTabrakan {
  kejadian: KejadianTabrakan[]
  jmlTabrakan: number
  jmlNyaris: number
  jmlJalanMundur: number
}

/** #26 — lintasan diambil dari penjejak bersama `jejakJalur.ts`, ditambah data ruang aman alat. */
interface DeskriptorLintasanPemain extends JalurPemain {
  anggota: Member
  radiusYd: number
  radiusLangkah: number
  kategoriAlat: KategoriRuangInstrumen
}

interface SampelPosisiPemain {
  desc: DeskriptorLintasanPemain
  x: number
  y: number
  vx: number
  vy: number
  sedangBergerak: boolean
  jalanMundur: boolean
}

/**
 * Hitung jarak terdekat dari titik `(px, py)` ke properti `FieldMarker` (`'kotak'` berotasi
 * maupun `'titik'` berjari-jari), beserta titik kontak terdekatnya di ruang yard.
 */
export function jarakTitikKePropertiYd(
  px: number,
  py: number,
  prop: FieldMarker,
  stepYd: number,
): { jarakTepiYd: number; kontakX: number; kontakY: number } | null {
  if (prop.jenis === 'kotak') {
    const x2 = prop.x2 ?? prop.x
    const y2 = prop.y2 ?? prop.y
    const lebar = Math.abs(x2 - prop.x)
    const tinggi = Math.abs(y2 - prop.y)
    // Abaikan kotak pembatas raksasa (> 22 yd) yang dipakai sebagai bingkai zona latihan
    // kecuali memang ditandai sebagai properti bergerak atau punya kru pendorong.
    if (
      lebar < 0.15 ||
      tinggi < 0.15 ||
      ((lebar > 22 || tinggi > 22) && !apakahPropertiBergerak(prop) && !prop.kruIds?.length)
    ) {
      return null
    }
    const cx = (prop.x + x2) / 2
    const cy = (prop.y + y2) / 2
    const hx = lebar / 2
    const hy = tinggi / 2
    const rad = ((prop.rotasi ?? 0) * Math.PI) / 180
    const cos = Math.cos(rad)
    const sin = Math.sin(rad)
    const dx = px - cx
    const dy = py - cy
    // Putar ke kerangka lokal kotak (-rad)
    const lx = dx * cos + dy * sin
    const ly = -dx * sin + dy * cos
    const jepitX = Math.max(-hx, Math.min(hx, lx))
    const jepitY = Math.max(-hy, Math.min(hy, ly))
    const diDalam = Math.abs(lx) <= hx && Math.abs(ly) <= hy
    const jarakTepiYd = diDalam ? 0 : Math.hypot(lx - jepitX, ly - jepitY)
    // Kembalikan titik kontak ke kerangka lapangan (+rad)
    const kx = cx + jepitX * cos - jepitY * sin
    const ky = cy + jepitX * sin + jepitY * cos
    return { jarakTepiYd, kontakX: kx, kontakY: ky }
  }

  if (prop.jenis === 'titik') {
    const rProp = prop.r ?? 0
    if (rProp < stepYd * 0.55 && !apakahPropertiBergerak(prop) && !prop.kruIds?.length) {
      return null
    }
    const rEfektif = Math.max(rProp, stepYd * 0.5)
    const dx = px - prop.x
    const dy = py - prop.y
    const dPusat = Math.hypot(dx, dy)
    const jarakTepiYd = Math.max(0, dPusat - rEfektif)
    const ux = dPusat > 1e-6 ? dx / dPusat : 0
    const uy = dPusat > 1e-6 ? dy / dPusat : 0
    return {
      jarakTepiYd,
      kontakX: prop.x + ux * Math.min(dPusat, rEfektif),
      kontakY: prop.y + uy * Math.min(dPusat, rEfektif),
    }
  }

  return null
}

/**
 * Periksa seluruh benturan lintasan antar-pemain & pemain-properti pada perpindahan
 * `dari` → `ke` dengan pencuplikan rapat setiap `0,25` hitungan.
 */
export function periksaTabrakanSet(opsi: {
  dari: DrillSet | undefined
  ke: DrillSet | undefined
  anggota: Member[]
  stepYd: number
  markers?: FieldMarker[]
  sets?: Pick<DrillSet, 'id'>[]
  idxSet?: number
  hanya?: Set<string>
  selangCount?: number
}): HasilPemeriksaanTabrakan {
  const { dari, ke, anggota, markers, sets, idxSet = 0, hanya } = opsi
  const sYd = opsi.stepYd > 0 ? opsi.stepYd : 5 / 8
  const kosong: HasilPemeriksaanTabrakan = {
    kejadian: [],
    jmlTabrakan: 0,
    jmlNyaris: 0,
    jmlJalanMundur: 0,
  }
  if (!dari || !ke) return kosong
  const counts = Math.max(0, Math.floor(dari.counts || 0))
  if (counts <= 0) return kosong

  const penjejak = buatPenjejakSet({ dari, ke, anggota, hanya })
  const g = penjejak.g

  const deskriptor: DeskriptorLintasanPemain[] = []
  let radiusMaksYd = sYd

  for (const m of anggota) {
    const jalur = penjejak.jalur.get(m.id)
    if (!jalur) continue
    const infoAlat = radiusAmanInstrumen(m, sYd)
    if (infoAlat.radiusYd > radiusMaksYd) radiusMaksYd = infoAlat.radiusYd
    deskriptor.push({
      ...jalur,
      anggota: m,
      radiusYd: infoAlat.radiusYd,
      radiusLangkah: infoAlat.radiusLangkah,
      kategoriAlat: infoAlat.kategori,
    })
  }

  if (deskriptor.length === 0) return kosong

  const selang = opsi.selangCount && opsi.selangCount > 0 ? opsi.selangCount : 0.25
  const jmlSampel = Math.max(1, Math.round(counts / selang))
  const dtP = 1 / Math.max(8, counts * 4)
  const ukuranSelGrid = Math.max(sYd * 2, radiusMaksYd * 2.5)

  const rekamKejadian = new Map<string, KejadianTabrakan>()

  function catatBenturan(kunci: string, baru: Omit<KejadianTabrakan, 'countAwal' | 'countAkhir'>) {
    const lama = rekamKejadian.get(kunci)
    if (!lama) {
      rekamKejadian.set(kunci, {
        ...baru,
        countAwal: baru.padaCount,
        countAkhir: baru.padaCount,
      })
      return
    }
    const countAwal = Math.min(lama.countAwal, baru.padaCount)
    const countAkhir = Math.max(lama.countAkhir, baru.padaCount)
    if (baru.jarakYd < lama.jarakYd - 1e-6) {
      rekamKejadian.set(kunci, {
        ...baru,
        jalanMundur: lama.jalanMundur || baru.jalanMundur,
        countAwal,
        countAkhir,
      })
    } else {
      lama.countAwal = countAwal
      lama.countAkhir = countAkhir
      if (baru.jalanMundur) lama.jalanMundur = true
    }
  }

  const adaPropKandidat = Boolean(
    markers?.some((mk) => mk.jenis === 'kotak' || mk.jenis === 'titik'),
  )

  for (let si = 0; si <= jmlSampel; si++) {
    const padaCount = Math.round(((si * counts) / jmlSampel) * 100) / 100
    const p = Math.min(1, Math.max(0, si / jmlSampel))
    const diUjungSet = si === 0 || si === jmlSampel

    // 1) Evaluasi posisi & vektor kecepatan sesaat tiap pemain + masukkan ke Spatial Hash Grid
    const sampel: SampelPosisiPemain[] = new Array(deskriptor.length)
    const grid = new Map<string, number[]>()

    for (let i = 0; i < deskriptor.length; i++) {
      const d = deskriptor[i]
      const pos = posisiJalurPadaP(d, dari, g, counts, p)
      let vx = 0
      let vy = 0
      let sedangBergerak = false
      if (!d.diam) {
        const pSebelum = Math.max(0, p - dtP)
        const pSesudah = Math.min(1, p + dtP)
        const a = posisiJalurPadaP(d, dari, g, counts, pSebelum)
        const b = posisiJalurPadaP(d, dari, g, counts, pSesudah)
        vx = b.x - a.x
        vy = b.y - a.y
        sedangBergerak = Math.hypot(vx, vy) > sYd * 0.04
      }
      const jalanMundur =
        sedangBergerak &&
        apakahJalanMundur(vx, vy, d.awal.facing, d.awal.facingDeg, sYd * 0.04)

      sampel[i] = { desc: d, x: pos.x, y: pos.y, vx, vy, sedangBergerak, jalanMundur }

      const gx = Math.floor(pos.x / ukuranSelGrid)
      const gy = Math.floor(pos.y / ukuranSelGrid)
      const kunciSel = `${gx}:${gy}`
      const daftarSel = grid.get(kunciSel)
      if (daftarSel) daftarSel.push(i)
      else grid.set(kunciSel, [i])
    }

    // 2) Uji pasangan pemain di sel tetangga 3×3 (O(N) rata-rata)
    for (let i = 0; i < sampel.length; i++) {
      const sa = sampel[i]
      const gx = Math.floor(sa.x / ukuranSelGrid)
      const gy = Math.floor(sa.y / ukuranSelGrid)

      for (let ox = -1; ox <= 1; ox++) {
        for (let oy = -1; oy <= 1; oy++) {
          const tetangga = grid.get(`${gx + ox}:${gy + oy}`)
          if (!tetangga) continue
          for (const j of tetangga) {
            if (j <= i) continue
            const sb = sampel[j]
            const dx = sb.x - sa.x
            const dy = sb.y - sa.y
            const jarakYd = Math.hypot(dx, dy)
            const jarakLangkah = jarakYd / sYd

            // Di ujung awal/akhir set (formasi berhenti), barisan tiup rapat >= 0,72 langkah
            // sengaja diizinkan kecuali titik benar-benar menumpuk (< 0,65 langkah).
            if (diUjungSet && (!sa.sedangBergerak || !sb.sedangBergerak)) {
              if (jarakLangkah >= 0.65) continue
            } else if (!sa.sedangBergerak && !sb.sedangBergerak) {
              if (jarakLangkah >= 0.65) continue
            }

            const mundurBerisiko =
              (sa.jalanMundur || sb.jalanMundur) && (sa.sedangBergerak || sb.sedangBergerak)
            const faktorMundur = mundurBerisiko ? 1.15 : 1
            const batasAmanYd = (sa.desc.radiusYd + sb.desc.radiusYd) * faktorMundur
            if (jarakYd >= batasAmanYd) continue

            const batasAmanLangkah = Math.round((batasAmanYd / sYd) * 100) / 100
            const tingkat: TingkatBenturan =
              jarakYd <= batasAmanYd * 0.65 || jarakLangkah < 0.62 ? 'tabrakan' : 'nyaris'
            const [id1, id2] = sa.desc.id < sb.desc.id ? [sa, sb] : [sb, sa]
            const kunci = `p:${id1.desc.id}::${id2.desc.id}`
            const kode1 = id1.desc.anggota.code || id1.desc.anggota.name
            const kode2 = id2.desc.anggota.code || id2.desc.anggota.name
            const infoMundur = mundurBerisiko ? ' · jalan mundur' : ''
            catatBenturan(kunci, {
              id: kunci,
              jenis: 'antar_pemain',
              tingkat,
              idA: id1.desc.id,
              kodeA: kode1,
              namaA: id1.desc.anggota.name,
              seksiA: id1.desc.anggota.section,
              idB: id2.desc.id,
              kodeB: kode2,
              namaB: id2.desc.anggota.name,
              seksiB: id2.desc.anggota.section,
              padaCount,
              jarakYd: Math.round(jarakYd * 1000) / 1000,
              jarakLangkah: Math.round(jarakLangkah * 100) / 100,
              batasAmanLangkah,
              x: Math.round(((sa.x + sb.x) / 2) * 1000) / 1000,
              y: Math.round(((sa.y + sb.y) / 2) * 1000) / 1000,
              jalanMundur: mundurBerisiko,
              ringkasan: `${kode1} × ${kode2} pada hit. ${padaCount} (${(Math.round(jarakLangkah * 10) / 10).toFixed(1)} lk${infoMundur})`,
            })
          }
        }
      }
    }

    // 3) Uji pemain vs properti panggung / Moving Props (#16.4)
    if (adaPropKandidat && markers?.length) {
      const propSaatIni = penandaEfektifPadaSet(
        markers,
        sets?.length ? sets : [dari, ke],
        sets?.length ? idxSet : 0,
        p,
      )
      for (const prop of propSaatIni) {
        if (prop.jenis !== 'kotak' && prop.jenis !== 'titik') continue
        for (const sp of sampel) {
          // Kru pendorong properti memang bertugas memegang properti tersebut
          if (prop.kruIds?.includes(sp.desc.id)) continue
          const hit = jarakTitikKePropertiYd(sp.x, sp.y, prop, sYd)
          if (!hit) continue
          const batasPropYd = sp.desc.radiusYd * (sp.jalanMundur ? 1.15 : 0.95)
          if (hit.jarakTepiYd >= batasPropYd) continue
          // Bila pemain & properti sama-sama diam sejak awal di tepi luar kotak, jangan bising
          const propBergerak = apakahPropertiBergerak(prop)
          if (diUjungSet && !sp.sedangBergerak && !propBergerak && hit.jarakTepiYd > sYd * 0.2) {
            continue
          }
          const jarakLangkah = hit.jarakTepiYd / sYd
          const tingkat: TingkatBenturan =
            hit.jarakTepiYd <= batasPropYd * 0.45 ? 'tabrakan' : 'nyaris'
          const kodeA = sp.desc.anggota.code || sp.desc.anggota.name
          const labelProp = prop.label?.trim() || 'Properti'
          const kunci = `m:${sp.desc.id}::${prop.id}`
          catatBenturan(kunci, {
            id: kunci,
            jenis: 'pemain_properti',
            tingkat,
            idA: sp.desc.id,
            kodeA,
            namaA: sp.desc.anggota.name,
            seksiA: sp.desc.anggota.section,
            idB: prop.id,
            kodeB: labelProp,
            namaB: labelProp,
            padaCount,
            jarakYd: Math.round(hit.jarakTepiYd * 1000) / 1000,
            jarakLangkah: Math.round(jarakLangkah * 100) / 100,
            batasAmanLangkah: Math.round((batasPropYd / sYd) * 100) / 100,
            x: Math.round(hit.kontakX * 1000) / 1000,
            y: Math.round(hit.kontakY * 1000) / 1000,
            jalanMundur: sp.jalanMundur,
            ringkasan: `${kodeA} × [${labelProp}] pada hit. ${padaCount} (${(Math.round(jarakLangkah * 10) / 10).toFixed(1)} lk)`,
          })
        }
      }
    }
  }

  const kejadian = [...rekamKejadian.values()].sort((a, b) => {
    if (a.tingkat !== b.tingkat) return a.tingkat === 'tabrakan' ? -1 : 1
    if (Math.abs(a.jarakLangkah - b.jarakLangkah) > 0.02) return a.jarakLangkah - b.jarakLangkah
    return a.padaCount - b.padaCount
  })

  return {
    kejadian,
    jmlTabrakan: kejadian.filter((k) => k.tingkat === 'tabrakan').length,
    jmlNyaris: kejadian.filter((k) => k.tingkat === 'nyaris').length,
    jmlJalanMundur: kejadian.filter((k) => k.jalanMundur).length,
  }
}

/* ============================================================================
 * 3. Pemeriksa Kerataan Interval Barisan (Spacing Drift Linter)
 * ========================================================================== */

export interface TemuanKerataanSpasi {
  id: string
  label: string
  /** Urutan ID anggota dari ujung ke ujung barisan. */
  memberIds: string[]
  kodeUrut: string[]
  /** Jarak antar-tetangga berurutan dalam langkah. */
  spasiLangkah: number[]
  /** Spasi rata-rata ideal bila diratakan di antara kedua ujung. */
  spasiRataLangkah: number
  /** Selisih terbesar sebuah celah dari spasi rata-rata (dalam langkah). */
  simpanganMaksLangkah: number
  /** Titik ujung barisan (dipakai untuk meratakan spasi atau mengikat ke Bentuk #22). */
  p0: { x: number; y: number }
  p1: { x: number; y: number }
}

function medianAngka(arr: number[]): number {
  if (!arr.length) return 0
  const urut = [...arr].sort((a, b) => a - b)
  const mid = Math.floor(urut.length / 2)
  return urut.length % 2 === 1 ? urut[mid] : (urut[mid - 1] + urut[mid]) / 2
}

/**
 * Uji apakah sekumpulan kandidat titik membentuk satu barisan lurus (mendatar, tegak,
 * atau miring) yang jaraknya melenceng tak sengaja (*spacing drift*).
 */
function periksaSatuKelompokBarisan(
  idGrup: string,
  labelGrup: string,
  ids: string[],
  points: Record<string, DrillPoint>,
  kodeById: Map<string, string>,
  sYd: number,
  minimalAnggota: number,
): TemuanKerataanSpasi | null {
  const valid = ids.filter((id) => Boolean(points[id]))
  if (valid.length < minimalAnggota) return null

  // Cari pasangan titik terjauh sebagai sumbu utama barisan (P0 -> P1)
  let idxA = 0
  let idxB = 1
  let dMaks = -1
  for (let i = 0; i < valid.length; i++) {
    for (let j = i + 1; j < valid.length; j++) {
      const pi = points[valid[i]]
      const pj = points[valid[j]]
      const d = Math.hypot(pj.x - pi.x, pj.y - pi.y)
      if (d > dMaks) {
        dMaks = d
        idxA = i
        idxB = j
      }
    }
  }
  if (dMaks < sYd * (minimalAnggota - 1) * 0.8) return null

  const a = points[valid[idxA]]
  const b = points[valid[idxB]]
  const ux = (b.x - a.x) / dMaks
  const uy = (b.y - a.y) / dMaks

  // Pastikan seluruh anggota benar-benar segaris (simpangan tegak lurus <= 0,55 langkah)
  const proyeksi: { id: string; proj: number; perp: number }[] = []
  for (const id of valid) {
    const pt = points[id]
    const vx = pt.x - a.x
    const vy = pt.y - a.y
    const proj = vx * ux + vy * uy
    const perp = Math.abs(-vx * uy + vy * ux)
    if (perp > sYd * 0.55) return null
    proyeksi.push({ id, proj, perp })
  }

  proyeksi.sort((x, y) => x.proj - y.proj)
  const spasiLangkah: number[] = []
  for (let i = 0; i < proyeksi.length - 1; i++) {
    const pKiri = points[proyeksi[i].id]
    const pKanan = points[proyeksi[i + 1].id]
    spasiLangkah.push(Math.hypot(pKanan.x - pKiri.x, pKanan.y - pKiri.y) / sYd)
  }

  const med = medianAngka(spasiLangkah)
  // Hanya periksa barisan dengan spasi wajar 1,2..8,5 langkah (bukan 2 blok terpisah jauh)
  if (med < 1.2 || med > 8.5) return null
  const maksCelah = Math.max(...spasiLangkah)
  const minCelah = Math.min(...spasiLangkah)
  if (maksCelah > med * 2.35 || minCelah < 0.35) return null

  const rata = dMaks / sYd / (proyeksi.length - 1)
  const simpanganMaks = Math.max(...spasiLangkah.map((g) => Math.abs(g - rata)))
  // Ambang drift: melenceng >= 0,32 langkah (~7 inci) dari spasi rata-rata
  if (simpanganMaks < 0.32) return null

  const urutIds = proyeksi.map((p) => p.id)
  const pAwal = points[urutIds[0]]
  const pAkhir = points[urutIds[urutIds.length - 1]]
  return {
    id: idGrup,
    label: labelGrup,
    memberIds: urutIds,
    kodeUrut: urutIds.map((id) => kodeById.get(id) ?? id),
    spasiLangkah: spasiLangkah.map((v) => Math.round(v * 100) / 100),
    spasiRataLangkah: Math.round(rata * 100) / 100,
    simpanganMaksLangkah: Math.round(simpanganMaks * 100) / 100,
    p0: { x: pAwal.x, y: pAwal.y },
    p1: { x: pAkhir.x, y: pAkhir.y },
  }
}

/**
 * Pindai ketidaksengajaan spasi tidak rata pada barisan lurus non-terikat di `set`.
 *
 * Titik yang sudah diikat ke `set.bentukTerikat` (#22) otomatis dilewati saat pemindaian
 * umum agar tidak berulang, namun tetap diuji bila pelatih memilih barisan secara eksplisit.
 */
export function periksaKerataanSpasi(opsi: {
  set: Pick<DrillSet, 'points' | 'bentukTerikat'> | undefined
  anggota: Member[]
  stepYd: number
  selectedIds?: string[]
  hanya?: Set<string>
}): TemuanKerataanSpasi[] {
  const { set, anggota, selectedIds, hanya } = opsi
  const sYd = opsi.stepYd > 0 ? opsi.stepYd : 5 / 8
  if (!set) return []

  const terikat = new Set<string>()
  for (const b of set.bentukTerikat ?? []) {
    for (const id of b.memberIds) terikat.add(id)
  }

  const kodeById = new Map<string, string>()
  const perSeksi = new Map<string, string[]>()
  const perTag = new Map<string, string[]>()
  const perBarisY = new Map<number, string[]>()

  for (const m of anggota) {
    kodeById.set(m.id, m.code || m.name)
    if (hanya && !hanya.has(m.id)) continue
    if (!set.points[m.id] || terikat.has(m.id)) continue
    const daftarSeksi = perSeksi.get(m.section) ?? []
    daftarSeksi.push(m.id)
    perSeksi.set(m.section, daftarSeksi)

    for (const tg of m.tags ?? []) {
      const k = tg.trim()
      if (!k) continue
      const dt = perTag.get(k) ?? []
      dt.push(m.id)
      perTag.set(k, dt)
    }

    // Klaster barisan mendatar lintas-seksi (company front / sub-front pada y serupa)
    const emberY = Math.round(set.points[m.id].y / (sYd * 0.75))
    const dy = perBarisY.get(emberY) ?? []
    dy.push(m.id)
    perBarisY.set(emberY, dy)
  }

  const hasil: TemuanKerataanSpasi[] = []
  const kunciUnik = new Set<string>()
  const tambahBilaBaru = (t: TemuanKerataanSpasi | null) => {
    if (!t) return
    const sig = [...t.memberIds].sort().join(',')
    if (kunciUnik.has(sig)) return
    kunciUnik.add(sig)
    hasil.push(t)
  }

  // 1) Pilihan aktif (>= 3 titik dipilih manual oleh pelatih)
  if (selectedIds && selectedIds.length >= 3) {
    tambahBilaBaru(
      periksaSatuKelompokBarisan(
        'pilihan',
        `Pilihan (${selectedIds.length} pemain)`,
        selectedIds,
        set.points,
        kodeById,
        sYd,
        3,
      ),
    )
  }

  // 2) Per Tag lintas-seksi (>= 3 pemain)
  for (const [tg, ids] of perTag.entries()) {
    tambahBilaBaru(
      periksaSatuKelompokBarisan(`tag:${tg}`, `#${tg}`, ids, set.points, kodeById, sYd, 3),
    )
  }

  // 3) Per Section (>= 4 pemain)
  for (const [sec, ids] of perSeksi.entries()) {
    tambahBilaBaru(
      periksaSatuKelompokBarisan(`seksi:${sec}`, `Barisan ${sec}`, ids, set.points, kodeById, sYd, 4),
    )
  }

  // 4) Barisan mendatar (y serupa, >= 4 pemain)
  for (const [ember, ids] of perBarisY.entries()) {
    tambahBilaBaru(
      periksaSatuKelompokBarisan(
        `barisY:${ember}`,
        `Saf mendatar (${ids.length} pemain)`,
        ids,
        set.points,
        kodeById,
        sYd,
        4,
      ),
    )
  }

  return hasil.sort((a, b) => b.simpanganMaksLangkah - a.simpanganMaksLangkah)
}

/**
 * Hitung koordinat baru yang meratakan spasi `memberIds` secara presisi sepanjang
 * segmen lurus dari pemain ujung pertama ke pemain ujung terakhir.
 */
export function ratakanSpasiBarisan(
  points: Record<string, DrillPoint>,
  sasaran: readonly string[] | Pick<TemuanKerataanSpasi, 'memberIds'>,
): Record<string, DrillPoint> {
  const daftarId = Array.isArray(sasaran)
    ? sasaran
    : (sasaran as Pick<TemuanKerataanSpasi, 'memberIds'>).memberIds
  const valid = daftarId.filter((id) => Boolean(points[id]))
  if (valid.length < 3) return { ...points }
  const awal = points[valid[0]]
  const akhir = points[valid[valid.length - 1]]
  const n = valid.length - 1
  const out: Record<string, DrillPoint> = { ...points }
  valid.forEach((id, i) => {
    const t = i / n
    out[id] = {
      ...points[id],
      x: Math.round((awal.x + (akhir.x - awal.x) * t) * 1000) / 1000,
      y: Math.round((awal.y + (akhir.y - awal.y) * t) * 1000) / 1000,
    }
  })
  return out
}

/* ============================================================================
 * 4. Penyelesai Jalur Bersilang 1-Klik (2-Opt Assignment Uncrosser)
 * ========================================================================== */

export interface SaranTukarSilang {
  id: string
  seksi: string
  idA: string
  kodeA: string
  idB: string
  kodeB: string
  /** Penghematan total jarak tempuh kedua pemain dalam satuan langkah. */
  hematLangkah: number
  /** Posisi awal & tujuan lama/baru untuk menggambar panah pratinjau di kanvas. */
  asalA: { x: number; y: number }
  asalB: { x: number; y: number }
  tujuanLamaA: { x: number; y: number }
  tujuanLamaB: { x: number; y: number }
}

function orientasi2D(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
): number {
  return (bx - ax) * (cy - ay) - (by - ay) * (cx - ax)
}

/**
 * Uji apakah dua segmen gerak `p1 → q1` dan `p2 → q2` benar-benar bersilangan
 * (atau berpapasan nyaris segaris berlawanan arah).
 */
export function segmenJalurBersilangan(
  p1: { x: number; y: number },
  q1: { x: number; y: number },
  p2: { x: number; y: number },
  q2: { x: number; y: number },
  tolKolinearYd = 0.25,
): boolean {
  const o1 = orientasi2D(p1.x, p1.y, q1.x, q1.y, p2.x, p2.y)
  const o2 = orientasi2D(p1.x, p1.y, q1.x, q1.y, q2.x, q2.y)
  const o3 = orientasi2D(p2.x, p2.y, q2.x, q2.y, p1.x, p1.y)
  const o4 = orientasi2D(p2.x, p2.y, q2.x, q2.y, q1.x, q1.y)

  if (((o1 > 1e-6 && o2 < -1e-6) || (o1 < -1e-6 && o2 > 1e-6)) &&
      ((o3 > 1e-6 && o4 < -1e-6) || (o3 < -1e-6 && o4 > 1e-6))) {
    return true
  }

  // Kasus khusus: dua pemain bertukar tempat persis di satu garis lurus berlawanan arah!
  const v1x = q1.x - p1.x
  const v1y = q1.y - p1.y
  const v2x = q2.x - p2.x
  const v2y = q2.y - p2.y
  const len1 = Math.hypot(v1x, v1y)
  const len2 = Math.hypot(v2x, v2y)
  if (len1 < 1e-4 || len2 < 1e-4) return false
  // Berlawanan arah (dot < -0.7) dan jarak garis kedua segmen < tolKolinearYd serta tumpang tindih
  const dot = (v1x * v2x + v1y * v2y) / (len1 * len2)
  if (dot < -0.7) {
    const ux = v1x / len1
    const uy = v1y / len1
    const perpP2 = Math.abs(-(p2.x - p1.x) * uy + (p2.y - p1.y) * ux)
    const perpQ2 = Math.abs(-(q2.x - p1.x) * uy + (q2.y - p1.y) * ux)
    if (perpP2 <= tolKolinearYd && perpQ2 <= tolKolinearYd) {
      const projP2 = (p2.x - p1.x) * ux + (p2.y - p1.y) * uy
      const projQ2 = (q2.x - p1.x) * ux + (q2.y - p1.y) * uy
      const min2 = Math.min(projP2, projQ2)
      const max2 = Math.max(projP2, projQ2)
      if (max2 > 0.05 && min2 < len1 - 0.05) return true
    }
  }

  return false
}

/**
 * Cari pasangan pemain dalam seksi yang sama yang jalurnya bersilangan menuju set
 * berikutnya dan akan lebih pendek serta bebas silang bila titik tujuannya ditukar (*2-Opt*).
 *
 * Catatan: pemain dalam barisan Follow-the-Leader (`jalur === 'ftl'`) tidak diutak-atik
 * karena urutan barisan FTL disengaja oleh koreografer.
 */
export function cariSaranTukarSilang(opsi: {
  dari: DrillSet | undefined
  ke: DrillSet | undefined
  anggota: Member[]
  stepYd: number
  hanya?: Set<string>
}): SaranTukarSilang[] {
  const { dari, ke, anggota, hanya } = opsi
  const sYd = opsi.stepYd > 0 ? opsi.stepYd : 5 / 8
  if (!dari || !ke) return []

  const idFtl = new Set<string>()
  for (const klp of dari.gerak?.kelompok ?? []) {
    if (klp.jalur === 'ftl') {
      for (const id of klp.memberIds) idFtl.add(id)
    }
  }

  const perSeksi = new Map<string, Member[]>()
  for (const m of anggota) {
    if (hanya && !hanya.has(m.id)) continue
    if (idFtl.has(m.id)) continue
    if (!dari.points[m.id] || !ke.points[m.id]) continue
    const daftar = perSeksi.get(m.section) ?? []
    daftar.push(m)
    perSeksi.set(m.section, daftar)
  }

  const kandidat: SaranTukarSilang[] = []

  for (const [seksi, grup] of perSeksi.entries()) {
    for (let i = 0; i < grup.length; i++) {
      for (let j = i + 1; j < grup.length; j++) {
        const ma = grup[i]
        const mb = grup[j]
        const pa = dari.points[ma.id]
        const qa = ke.points[ma.id]
        const pb = dari.points[mb.id]
        const qb = ke.points[mb.id]
        if (!segmenJalurBersilangan(pa, qa, pb, qb, sYd * 0.45)) continue

        const jarakLama = Math.hypot(qa.x - pa.x, qa.y - pa.y) + Math.hypot(qb.x - pb.x, qb.y - pb.y)
        const jarakBaru = Math.hypot(qb.x - pa.x, qb.y - pa.y) + Math.hypot(qa.x - pb.x, qa.y - pb.y)
        const hematYd = jarakLama - jarakBaru
        // Untuk dua segmen yang menyilang murni di bidang Euclid, ketaksamaan segitiga
        // menjamin hematYd > 0; ambang kecil 0,08 langkah mencegah tukar hampir-nol.
        if (hematYd < sYd * 0.08) continue

        const kodeA = ma.code || ma.name
        const kodeB = mb.code || mb.name
        kandidat.push({
          id: `tukar:${ma.id}::${mb.id}`,
          seksi,
          idA: ma.id,
          kodeA,
          idB: mb.id,
          kodeB,
          hematLangkah: Math.round((hematYd / sYd) * 10) / 10,
          asalA: { x: pa.x, y: pa.y },
          asalB: { x: pb.x, y: pb.y },
          tujuanLamaA: { x: qa.x, y: qa.y },
          tujuanLamaB: { x: qb.x, y: qb.y },
        })
      }
    }
  }

  // Urutkan penghematan langkah terbesar dulu, lalu pilih pasangan saling lepas (disjoint)
  // supaya satu klik "Terapkan Semua" tidak menukar satu orang dua kali secara bertabrakan.
  kandidat.sort((a, b) => b.hematLangkah - a.hematLangkah)
  const terpakai = new Set<string>()
  const terpilih: SaranTukarSilang[] = []
  for (const s of kandidat) {
    if (terpakai.has(s.idA) || terpakai.has(s.idB)) continue
    terpakai.add(s.idA)
    terpakai.add(s.idB)
    terpilih.push(s)
  }
  return terpilih
}

/**
 * Terapkan daftar saran pertukaran slot tujuan pada salinan `kePoints` (`nextSet.points`).
 * Seluruh atribut slot tujuan (`x`, `y`, `facing`, `facingDeg`) dipertukarkan sehingga
 * bentuk dan arah hadap formasi di set tujuan tetap 100% utuh sementara jalur silang terurai.
 */
export function terapkanTukarTujuan(
  kePoints: Record<string, DrillPoint>,
  saran: readonly Pick<SaranTukarSilang, 'idA' | 'idB'>[],
): Record<string, DrillPoint> {
  const baru: Record<string, DrillPoint> = { ...kePoints }
  for (const { idA, idB } of saran) {
    const qa = baru[idA]
    const qb = baru[idB]
    if (!qa || !qb) continue
    baru[idA] = { ...qb }
    baru[idB] = { ...qa }
  }
  return baru
}

/**
 * Pertukarkan urutan `idA ↔ idB` di dalam `bentukTerikat` milik set tujuan (bila ada),
 * sehingga penggeseran gagang bentuk hidup (#22) di kemudian hari tidak membalikkan slot lagi.
 */
export function tukarAnggotaPadaBentukTerikat(
  bentukTerikat: readonly BentukTerikat[] | undefined,
  saran: readonly Pick<SaranTukarSilang, 'idA' | 'idB'>[],
): BentukTerikat[] | undefined {
  if (!bentukTerikat?.length) return bentukTerikat ? [...bentukTerikat] : undefined
  let daftar = bentukTerikat.map((b) => ({ ...b, memberIds: [...b.memberIds] }))
  for (const { idA, idB } of saran) {
    daftar = daftar.map((b) => {
      const adaA = b.memberIds.includes(idA)
      const adaB = b.memberIds.includes(idB)
      if (!adaA && !adaB) return b
      return {
        ...b,
        memberIds: b.memberIds.map((m) => (m === idA ? idB : m === idB ? idA : m)),
      }
    })
  }
  return daftar
}

/**
 * Jalankan iterasi 2-Opt penuh hingga tidak ada lagi silang jalur di dalam seksi yang sama
 * (maksimum 12 putaran aman agar dijamin berhenti instan).
 */
export function selesaikanSemuaSilang2Opt(opsi: {
  dari: DrillSet
  ke: DrillSet
  anggota: Member[]
  stepYd: number
  hanya?: Set<string>
}): {
  kePointsBaru: Record<string, DrillPoint>
  bentukTerikatBaru: BentukTerikat[] | undefined
  jumlahPertukaran: number
  totalHematLangkah: number
} {
  let keSimulasi: DrillSet = {
    ...opsi.ke,
    points: { ...opsi.ke.points },
    bentukTerikat: opsi.ke.bentukTerikat,
  }
  let jumlahPertukaran = 0
  let totalHematLangkah = 0

  for (let putaran = 0; putaran < 12; putaran++) {
    const saran = cariSaranTukarSilang({
      dari: opsi.dari,
      ke: keSimulasi,
      anggota: opsi.anggota,
      stepYd: opsi.stepYd,
      hanya: opsi.hanya,
    })
    if (saran.length === 0) break
    keSimulasi = {
      ...keSimulasi,
      points: terapkanTukarTujuan(keSimulasi.points, saran),
      bentukTerikat: tukarAnggotaPadaBentukTerikat(keSimulasi.bentukTerikat, saran),
    }
    jumlahPertukaran += saran.length
    for (const s of saran) totalHematLangkah += s.hematLangkah
  }

  return {
    kePointsBaru: keSimulasi.points,
    bentukTerikatBaru: keSimulasi.bentukTerikat,
    jumlahPertukaran,
    totalHematLangkah: Math.round(totalHematLangkah * 10) / 10,
  }
}
