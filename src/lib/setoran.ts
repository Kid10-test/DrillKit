/**
 * #14 — Logika murni Matriks Setoran Hafalan (*Music & Visual Pass-Off Tracker*)
 * beserta pembangun dokumen cetak A4 murni hex.
 *
 * Modul ini **murni** (tanpa Dexie, React, atau DOM) supaya seluruh perhitungan
 * jenjang, persentase kesiapan per seksi/target/anggota, generator target dari
 * segmen lagu, resolusi penggabungan rekaman, dan keluaran HTML cetak A4 dapat
 * diuji langsung di Node lewat `qa/bangun-logika.sh`.
 */
import type {
  CatatanSetoran,
  JenjangSetoran,
  KategoriSetoran,
  Member,
  SectionDef,
  Song,
  TargetSetoran,
} from '../db/types'

export const URUTAN_JENJANG_SETORAN: JenjangSetoran[] = [
  'belum',
  'baca_lancar',
  'tempo_latihan',
  'tempo_asli',
  'hafal_musik',
  'lulus_gerak',
]

export const LABEL_JENJANG_SETORAN: Record<JenjangSetoran, string> = {
  belum: 'Belum',
  baca_lancar: 'Baca Lancar',
  tempo_latihan: 'Tempo Latihan',
  tempo_asli: 'Tempo Asli',
  hafal_musik: 'Hafal Musik',
  lulus_gerak: 'Lulus Sambil Gerak',
}

export const SINGKATAN_JENJANG_SETORAN: Record<JenjangSetoran, string> = {
  belum: '—',
  baca_lancar: 'Baca',
  tempo_latihan: 'Latihan',
  tempo_asli: 'Tempo',
  hafal_musik: 'Hafal',
  lulus_gerak: 'Lulus',
}

export const LABEL_KATEGORI_SETORAN: Record<KategoriSetoran, string> = {
  musik: 'Musik',
  visual: 'Visual / Gerak',
  gabungan: 'Musik + Gerak',
}

/** Palet hex murni untuk tampilan aplikasi bertema gelap (nol `oklch` / `color-mix`). */
export const WARNA_JENJANG_GELAP: Record<
  JenjangSetoran,
  { bg: string; border: string; text: string }
> = {
  belum: { bg: '#0f172a', border: '#334155', text: '#94a3b8' },
  baca_lancar: { bg: '#172554', border: '#2563eb', text: '#bfdbfe' },
  tempo_latihan: { bg: '#164e63', border: '#0891b2', text: '#a5f3fc' },
  tempo_asli: { bg: '#422006', border: '#d97706', text: '#fde68a' },
  hafal_musik: { bg: '#14532d', border: '#16a34a', text: '#bbf7d0' },
  lulus_gerak: { bg: '#064e3b', border: '#10b981', text: '#a7f3d0' },
}

/** Palet hex murni untuk cetak kertas putih A4 (nol `oklch` / `color-mix`). */
export const WARNA_JENJANG_CETAK: Record<
  JenjangSetoran,
  { bg: string; border: string; text: string }
> = {
  belum: { bg: '#f8fafc', border: '#cbd5e1', text: '#64748b' },
  baca_lancar: { bg: '#eff6ff', border: '#93c5fd', text: '#1d4ed8' },
  tempo_latihan: { bg: '#ecfeff', border: '#67e8f9', text: '#0e7490' },
  tempo_asli: { bg: '#fefce8', border: '#fcd34d', text: '#a16207' },
  hafal_musik: { bg: '#f0fdf4', border: '#86efac', text: '#15803d' },
  lulus_gerak: { bg: '#ecfdf5', border: '#34d399', text: '#047857' },
}

/** Bangun id deterministik untuk satu sel `[targetId × memberId]`. */
export function idCatatanSetoran(targetId: string, memberId: string): string {
  return `${targetId}__${memberId}`
}

/** Indeks numerik 0..5 untuk sebuah `JenjangSetoran`. */
export function indeksJenjangSetoran(j: JenjangSetoran | undefined | null): number {
  const idx = j ? URUTAN_JENJANG_SETORAN.indexOf(j) : 0
  return idx >= 0 ? idx : 0
}

/** Batas jenjang kelulusan efektif sebuah target (bawaan `'lulus_gerak'`). */
export function batasLulusEfektif(
  target?: Pick<TargetSetoran, 'batasLulus' | 'kategori'> | null,
): Exclude<JenjangSetoran, 'belum'> {
  if (target?.batasLulus && (target.batasLulus as string) !== 'belum') return target.batasLulus
  return 'lulus_gerak'
}

/** Apakah capaian `jenjang` sudah memenuhi/melampaui `batasLulus` target? */
export function apakahLulusSetoran(
  jenjang: JenjangSetoran | undefined | null,
  batasLulus: Exclude<JenjangSetoran, 'belum'> = 'lulus_gerak',
): boolean {
  return indeksJenjangSetoran(jenjang) >= indeksJenjangSetoran(batasLulus)
}

/**
 * Skor pecahan `0..1` untuk satu sel `[Anggota × Target]`:
 * proporsional terhadap langkah menuju `batasLulus`, dijepit maksimum `1`.
 */
export function skorJenjangSetoran(
  jenjang: JenjangSetoran | undefined | null,
  batasLulus: Exclude<JenjangSetoran, 'belum'> = 'lulus_gerak',
): number {
  const maks = Math.max(1, indeksJenjangSetoran(batasLulus))
  const cur = indeksJenjangSetoran(jenjang)
  return Math.min(1, Math.max(0, cur / maks))
}

/**
 * Siklus ketuk-cepat jenjang berikutnya:
 * naik satu langkah sampai `batasLulus` (atau `'lulus_gerak'` bila sudah di atasnya),
 * lalu kembali ke `'belum'` jika diketuk lagi setelah mencapai puncak.
 */
export function jenjangBerikutnya(
  sekarang: JenjangSetoran | undefined | null,
  batasLulus: Exclude<JenjangSetoran, 'belum'> = 'lulus_gerak',
): JenjangSetoran {
  const idx = indeksJenjangSetoran(sekarang)
  const idxBatas = Math.max(1, indeksJenjangSetoran(batasLulus))
  if (idx < idxBatas) {
    return URUTAN_JENJANG_SETORAN[idx + 1] ?? 'lulus_gerak'
  }
  return 'belum'
}

/** Apakah `target` diwajibkan untuk `anggota` berdasarkan pembatasan `target.sections`? */
export function targetBerlakuUntukAnggota(
  target: Pick<TargetSetoran, 'sections'>,
  anggota: Pick<Member, 'section'>,
): boolean {
  if (!target.sections || target.sections.length === 0) return true
  const s = (anggota.section ?? '').trim().toLowerCase()
  return target.sections.some((x) => x.trim().toLowerCase() === s)
}

/** Urutkan daftar target setoran secara stabil menurut `urutan`, lalu `createdAt`, lalu `judul`. */
export function urutkanTargetSetoran(targets: TargetSetoran[]): TargetSetoran[] {
  return [...targets].sort((a, b) => {
    const u = (a.urutan ?? 0) - (b.urutan ?? 0)
    if (u !== 0) return u
    const c = (a.createdAt ?? 0) - (b.createdAt ?? 0)
    if (c !== 0) return c
    return a.judul.localeCompare(b.judul, 'id')
  })
}

/**
 * Resolusi dua `CatatanSetoran` pada sel yang sama (mis. saat penggabungan
 * anggota duplikat di `namaAnggota.ts` atau sinkronisasi asisten `#15`):
 * menangkan jenjang yang lebih tinggi; bila seri, menangkan `diubahAt` terbaru.
 */
export function gabungCatatanSetoran(a: CatatanSetoran, b: CatatanSetoran): CatatanSetoran {
  const ia = indeksJenjangSetoran(a.jenjang)
  const ib = indeksJenjangSetoran(b.jenjang)
  if (ib > ia) return b
  if (ia > ib) return a
  return (b.diubahAt ?? 0) >= (a.diubahAt ?? 0) ? b : a
}

export interface DrafTargetSetoran {
  judul: string
  kategori: KategoriSetoran
  songId: string
  biramaDari: number
  biramaSampai: number
}

/**
 * Bangun saran target setoran otomatis dari segmen tempo lagu (`Song.tempoMap`)
 * atau pembagian blok 16-birama bila lagu belum memiliki banyak segmen.
 */
export function buatSaranTargetDariLagu(song: Song): DrafTargetSetoran[] {
  const maksBirama =
    song.panjangBirama && song.panjangBirama > 0
      ? song.panjangBirama
      : song.partitur?.jumlahBirama && song.partitur.jumlahBirama > 0
        ? song.partitur.jumlahBirama
        : 0

  const segmen = [...(song.tempoMap ?? [])]
    .filter((s) => Number.isFinite(s.measure) && s.measure >= 1)
    .sort((a, b) => a.measure - b.measure)

  const hasil: DrafTargetSetoran[] = []

  if (segmen.length >= 2) {
    for (let i = 0; i < segmen.length; i += 1) {
      const s = segmen[i]
      const dari = Math.max(1, Math.floor(s.measure))
      const berikut = segmen[i + 1]
      const sampai = berikut
        ? Math.max(dari, Math.floor(berikut.measure) - 1)
        : maksBirama >= dari
          ? maksBirama
          : dari + 15
      const labelSeg = s.label?.trim() || `Bagian ${i + 1}`
      hasil.push({
        judul: `${song.title} — ${labelSeg} (Bar ${dari}–${sampai})`,
        kategori: 'gabungan',
        songId: song.id,
        biramaDari: dari,
        biramaSampai: sampai,
      })
    }
    return hasil
  }

  const panjang = maksBirama > 0 ? maksBirama : 32
  const ukuranBlok = panjang <= 16 ? panjang : 16
  let dari = 1
  let bagian = 1
  while (dari <= panjang) {
    const sampai = Math.min(panjang, dari + ukuranBlok - 1)
    hasil.push({
      judul:
        ukuranBlok === panjang
          ? `${song.title} (Bar ${dari}–${sampai})`
          : `${song.title} — Bagian ${bagian} (Bar ${dari}–${sampai})`,
      kategori: 'gabungan',
      songId: song.id,
      biramaDari: dari,
      biramaSampai: sampai,
    })
    dari = sampai + 1
    bagian += 1
  }
  return hasil
}

/* -------------------------- Ringkasan & Statistik ------------------------- */

export interface RingkasanSetoranSeksi {
  sectionId: string
  label: string
  jumlahAnggota: number
  wajib: number
  lulus: number
  persenSiap: number
  persenLulus: number
}

export interface RingkasanSetoranPerTarget {
  target: TargetSetoran
  wajib: number
  lulus: number
  persenSiap: number
  persenLulus: number
  terlambat: boolean
}

export interface RingkasanSetoranPerAnggota {
  memberId: string
  wajib: number
  lulus: number
  belumLulus: number
  terlambat: number
  persenSiap: number
  persenLulus: number
}

export interface RingkasanSetoranTim {
  jumlahTarget: number
  jumlahAnggotaAktif: number
  totalWajib: number
  totalLulus: number
  totalTerlambat: number
  /** Rata-rata berbobot jenjang seluruh sel wajib (0–100). */
  persenSiap: number
  /** Persentase sel yang sudah lulus penuh 100% (0–100). */
  persenLulus: number
  perSeksi: RingkasanSetoranSeksi[]
  perTarget: RingkasanSetoranPerTarget[]
  perAnggota: Record<string, RingkasanSetoranPerAnggota>
  petaSel: Map<string, CatatanSetoran>
}

export function hitungRingkasanSetoranTim(
  targets: TargetSetoran[],
  catatan: CatatanSetoran[],
  members: Member[],
  sectionsTim: SectionDef[] = [],
  hariIniIso?: string,
): RingkasanSetoranTim {
  const urutTarget = urutkanTargetSetoran(targets)
  const aktif = members.filter((m) => m.active !== 0)
  const petaSel = new Map<string, CatatanSetoran>()
  for (const c of catatan) {
    if (!c?.targetId || !c?.memberId) continue
    const k = idCatatanSetoran(c.targetId, c.memberId)
    const ada = petaSel.get(k)
    petaSel.set(k, ada ? gabungCatatanSetoran(ada, c) : c)
  }

  const labelSeksiMap = new Map<string, string>()
  for (const s of sectionsTim) labelSeksiMap.set(s.id, s.label)

  let totalWajib = 0
  let totalLulus = 0
  let totalTerlambat = 0
  let akumSkor = 0

  const perAnggota: Record<string, RingkasanSetoranPerAnggota> = {}
  const akSeksi = new Map<
    string,
    { anggotaIds: Set<string>; wajib: number; lulus: number; skor: number }
  >()
  const akTarget = new Map<string, { wajib: number; lulus: number; skor: number }>()

  for (const t of urutTarget) {
    akTarget.set(t.id, { wajib: 0, lulus: 0, skor: 0 })
  }

  for (const m of aktif) {
    let mWajib = 0
    let mLulus = 0
    let mTerlambat = 0
    let mSkor = 0

    let entriSeksi = akSeksi.get(m.section)
    if (!entriSeksi) {
      entriSeksi = { anggotaIds: new Set(), wajib: 0, lulus: 0, skor: 0 }
      akSeksi.set(m.section, entriSeksi)
    }
    entriSeksi.anggotaIds.add(m.id)

    for (const t of urutTarget) {
      if (!targetBerlakuUntukAnggota(t, m)) continue
      const batas = batasLulusEfektif(t)
      const sel = petaSel.get(idCatatanSetoran(t.id, m.id))
      const jenjang = sel?.jenjang ?? 'belum'
      const lulus = apakahLulusSetoran(jenjang, batas)
      const skor = skorJenjangSetoran(jenjang, batas)
      const lewatTenggat = Boolean(hariIniIso && t.tenggat && t.tenggat < hariIniIso && !lulus)

      mWajib += 1
      if (lulus) mLulus += 1
      if (lewatTenggat) mTerlambat += 1
      mSkor += skor

      totalWajib += 1
      if (lulus) totalLulus += 1
      if (lewatTenggat) totalTerlambat += 1
      akumSkor += skor

      entriSeksi.wajib += 1
      if (lulus) entriSeksi.lulus += 1
      entriSeksi.skor += skor

      const et = akTarget.get(t.id)!
      et.wajib += 1
      if (lulus) et.lulus += 1
      et.skor += skor
    }

    perAnggota[m.id] = {
      memberId: m.id,
      wajib: mWajib,
      lulus: mLulus,
      belumLulus: Math.max(0, mWajib - mLulus),
      terlambat: mTerlambat,
      persenSiap: mWajib > 0 ? Math.round((mSkor / mWajib) * 100) : 0,
      persenLulus: mWajib > 0 ? Math.round((mLulus / mWajib) * 100) : 0,
    }
  }

  const perSeksi: RingkasanSetoranSeksi[] = [...akSeksi.entries()]
    .filter(([, v]) => v.wajib > 0 || urutTarget.length === 0)
    .map(([sectionId, v]) => ({
      sectionId,
      label: labelSeksiMap.get(sectionId) ?? sectionId,
      jumlahAnggota: v.anggotaIds.size,
      wajib: v.wajib,
      lulus: v.lulus,
      persenSiap: v.wajib > 0 ? Math.round((v.skor / v.wajib) * 100) : 0,
      persenLulus: v.wajib > 0 ? Math.round((v.lulus / v.wajib) * 100) : 0,
    }))

  const perTarget: RingkasanSetoranPerTarget[] = urutTarget.map((t) => {
    const v = akTarget.get(t.id) ?? { wajib: 0, lulus: 0, skor: 0 }
    return {
      target: t,
      wajib: v.wajib,
      lulus: v.lulus,
      persenSiap: v.wajib > 0 ? Math.round((v.skor / v.wajib) * 100) : 0,
      persenLulus: v.wajib > 0 ? Math.round((v.lulus / v.wajib) * 100) : 0,
      terlambat: Boolean(hariIniIso && t.tenggat && t.tenggat < hariIniIso && v.lulus < v.wajib),
    }
  })

  return {
    jumlahTarget: urutTarget.length,
    jumlahAnggotaAktif: aktif.length,
    totalWajib,
    totalLulus,
    totalTerlambat,
    persenSiap: totalWajib > 0 ? Math.round((akumSkor / totalWajib) * 100) : 0,
    persenLulus: totalWajib > 0 ? Math.round((totalLulus / totalWajib) * 100) : 0,
    perSeksi,
    perTarget,
    perAnggota,
    petaSel,
  }
}

/* --------------------- Pembangun HTML Cetak A4 Murni Hex ------------------ */

function escHtml(teks: string): string {
  return String(teks)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface OpsiCetakMatriksSetoran {
  namaTim: string
  subjudulSeksi?: string
  tanggalCetak: string
  targets: TargetSetoran[]
  members: Member[]
  catatan: CatatanSetoran[]
  sectionsTim?: SectionDef[]
}

/**
 * Bangun dokumen HTML mandiri siap cetak A4 untuk ditempel di ruang latihan.
 * Dijamin 100% murni warna `#hex` (nol `oklch()` / `color-mix()`).
 */
export function bangunHtmlCetakMatriksSetoran(opsi: OpsiCetakMatriksSetoran): string {
  const urutTarget = urutkanTargetSetoran(opsi.targets)
  const ringkasan = hitungRingkasanSetoranTim(
    urutTarget,
    opsi.catatan,
    opsi.members,
    opsi.sectionsTim ?? [],
  )
  const labelSeksi = new Map((opsi.sectionsTim ?? []).map((s) => [s.id, s.label]))
  const anggotaAktif = opsi.members.filter((m) => m.active !== 0)

  const thTarget = urutTarget
    .map((t, idx) => {
      const bar =
        t.biramaDari != null && t.biramaSampai != null
          ? `<div class="sub">Bar ${t.biramaDari}–${t.biramaSampai}</div>`
          : ''
      const tgl = t.tenggat ? `<div class="sub">Tenggat: ${escHtml(t.tenggat)}</div>` : ''
      return `<th><div class="judul-kol">#${idx + 1} ${escHtml(t.judul)}</div>${bar}${tgl}</th>`
    })
    .join('')

  const barisAnggota = anggotaAktif
    .map((m, idx) => {
      const ra = ringkasan.perAnggota[m.id]
      const selHtml = urutTarget
        .map((t) => {
          if (!targetBerlakuUntukAnggota(t, m)) {
            return `<td class="td-na">—</td>`
          }
          const sel = ringkasan.petaSel.get(idCatatanSetoran(t.id, m.id))
          const j = sel?.jenjang ?? 'belum'
          const w = WARNA_JENJANG_CETAK[j]
          const teks = SINGKATAN_JENJANG_SETORAN[j]
          return `<td style="background:${w.bg};color:${w.text};border-color:${w.border};font-weight:600;text-align:center;">${escHtml(teks)}</td>`
        })
        .join('')
      const nama = m.panggilan ? `${m.name} (${m.panggilan})` : m.name
      const seksi = labelSeksi.get(m.section) ?? m.section
      return `<tr>
        <td class="td-no">${idx + 1}</td>
        <td class="td-nama"><b>${escHtml(nama)}</b><span class="kode">${escHtml(m.code || '')}</span></td>
        <td class="td-seksi">${escHtml(seksi)}${m.instrument ? ` · ${escHtml(m.instrument)}` : ''}</td>
        ${selHtml}
        <td class="td-persen">${ra ? `${ra.lulus}/${ra.wajib} (${ra.persenSiap}%)` : '—'}</td>
      </tr>`
    })
    .join('\n')

  const legenda = URUTAN_JENJANG_SETORAN.map((j) => {
    const w = WARNA_JENJANG_CETAK[j]
    return `<span class="leg" style="background:${w.bg};border:1px solid ${w.border};color:${w.text};"><b>${escHtml(SINGKATAN_JENJANG_SETORAN[j])}</b> = ${escHtml(LABEL_JENJANG_SETORAN[j])}</span>`
  }).join(' ')

  return `<!DOCTYPE html>
<html lang="id">
<head>
<meta charset="utf-8" />
<title>Matriks Setoran Hafalan — ${escHtml(opsi.namaTim)}</title>
<style>
  @page { size: A4 landscape; margin: 10mm; }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 12px;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    color: #0f172a;
    background: #ffffff;
    font-size: 11px;
  }
  .kepala {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-bottom: 2px solid #0f172a;
    padding-bottom: 8px;
    margin-bottom: 10px;
  }
  h1 { margin: 0; font-size: 17px; color: #0f172a; }
  .meta { font-size: 11px; color: #475569; margin-top: 2px; }
  .ringkas-kotak {
    text-align: right;
    font-size: 11px;
    color: #1e293b;
  }
  .ringkas-kotak b { font-size: 14px; color: #047857; }
  .legenda {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 10px;
  }
  .leg {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 10px;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    font-size: 10.5px;
  }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 4px 6px;
    vertical-align: middle;
  }
  th {
    background: #f1f5f9;
    color: #0f172a;
    text-align: left;
    font-weight: 700;
  }
  .judul-kol { font-size: 10.5px; }
  .sub { font-size: 9px; font-weight: 400; color: #475569; margin-top: 1px; }
  .td-no { width: 26px; text-align: center; color: #64748b; }
  .td-nama { min-width: 140px; }
  .kode { margin-left: 5px; color: #64748b; font-size: 9.5px; }
  .td-seksi { min-width: 100px; color: #334155; }
  .td-na { text-align: center; color: #94a3b8; background: #f8fafc; }
  .td-persen { text-align: right; font-weight: 600; white-space: nowrap; background: #f8fafc; }
  @media print {
    body { padding: 0; }
    .no-print { display: none !important; }
  }
</style>
</head>
<body>
  <div class="kepala">
    <div>
      <h1>Matriks Setoran Hafalan — ${escHtml(opsi.namaTim)}</h1>
      <div class="meta">${escHtml(opsi.subjudulSeksi || 'Semua Seksi')} · Dicetak ${escHtml(opsi.tanggalCetak)}</div>
    </div>
    <div class="ringkas-kotak">
      Kesiapan Tim: <b>${ringkasan.persenSiap}%</b> · Lulus Penuh: <b>${ringkasan.totalLulus}/${ringkasan.totalWajib}</b> (${ringkasan.persenLulus}%)
    </div>
  </div>
  <div class="legenda">${legenda}</div>
  <table>
    <thead>
      <tr>
        <th class="td-no">#</th>
        <th>Anggota</th>
        <th>Seksi / Instrumen</th>
        ${thTarget}
        <th style="text-align:right;">Capaian</th>
      </tr>
    </thead>
    <tbody>
      ${barisAnggota}
    </tbody>
  </table>
</body>
</html>`
}
