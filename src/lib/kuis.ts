import type { CountSheet, DrillSet, FieldConfig, Member, SectionDef, SetList, Song } from '../db/types'
import { dariBeatsLama, labelBirama } from './birama'
import { fmtHitungan, infoXCountPemain, LABEL_ACUAN_DRESS, resolusiDress } from './bukuSakuPemain'
import { countSheetUntukAnggota, LABEL_ALAT_GUARD } from './countSheet'
import { DAFTAR_SIMBOL_VISUAL, infoSimbolVisual } from './gerak'

/**
 * C2 — mode kuis/hafalan untuk anggota: tebak posisi sendiri di set
 * berikutnya. Modul murni (tanpa React) supaya bisa diuji tanpa peramban.
 */

/** Satu soal: dari set A ke set B, di mana posisiku di B? */
export interface SoalKuis {
  dariSetId: string
  keSetId: string
  dariNama: string
  keNama: string
  /** Count yang tersedia untuk perpindahan (milik set asal). */
  counts: number
  /** Posisi saat ini — ditampilkan sebagai titik berangkat. */
  dari: { x: number; y: number }
  /** Posisi benar — kunci, disembunyikan sampai jawaban dikunci. */
  kunci: { x: number; y: number }
}

/** Toleransi jawaban benar, dalam langkah. */
export const TOLERANSI_LANGKAH = 2

/**
 * Susun soal dari seluruh perpindahan set: satu soal per pasangan set
 * berurutan. Anggota yang tidak ada di salah satu set (istirahat/prop)
 * membuat pasangannya dilewati — soalnya tidak punya kunci yang jujur.
 */
export function bangunSoal(sets: DrillSet[], memberId: string): SoalKuis[] {
  const urut = [...sets].sort((a, b) => a.order - b.order)
  const soal: SoalKuis[] = []
  for (let i = 0; i + 1 < urut.length; i++) {
    const dari = urut[i]
    const ke = urut[i + 1]
    const p = dari.points?.[memberId]
    const q = ke.points?.[memberId]
    if (!p || !q) continue
    soal.push({
      dariSetId: dari.id,
      keSetId: ke.id,
      dariNama: dari.name,
      keNama: ke.name,
      counts: dari.counts ?? 0,
      dari: { x: p.x, y: p.y },
      kunci: { x: q.x, y: q.y },
    })
  }
  return soal
}

export interface NilaiTebakan {
  /** Jarak tebakan ke kunci, dalam langkah (dua desimal). */
  jarakLangkah: number
  /** Benar bila tidak melebihi toleransi. */
  benar: boolean
}

/** Nilai satu tebakan terhadap kuncinya. */
export function nilaiTebakan(
  tebakan: { x: number; y: number },
  kunci: { x: number; y: number },
  sYd: number,
  toleransi = TOLERANSI_LANGKAH,
): NilaiTebakan {
  const jarak = Math.hypot(tebakan.x - kunci.x, tebakan.y - kunci.y) / sYd
  return {
    jarakLangkah: Math.round(jarak * 100) / 100,
    benar: jarak <= toleransi + 1e-9,
  }
}

/**
 * Acak urutan dengan benih (mulberry32) — benih yang sama selalu
 * menghasilkan urutan yang sama. **Benih 0 berarti jangan acak**: soal
 * mengikuti urutan set, untuk latihan berurutan dan untuk uji.
 */
export function acakUrutan<T>(daftar: T[], benih: number): T[] {
  if (!benih) return [...daftar]
  const rnd = pembangkitAcak(benih)
  const keluar = [...daftar]
  for (let i = keluar.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[keluar[i], keluar[j]] = [keluar[j], keluar[i]]
  }
  return keluar
}

/** mulberry32 — pembangkit acak berbenih (sama benih → sama urutan). */
function pembangkitAcak(benih: number): () => number {
  let a = benih >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ============================================================================
 * #29 — Kuis Show: soal pilihan ganda dari materi show milik anggota
 * ========================================================================== */

/**
 * Jenis soal Kuis Show. Semua dibangun dari paket anggota yang SUDAH ada
 * (tanpa data baru, tanpa data pribadi orang lain):
 * - `xcount`  — hitungan saat melintasi garis yard/hash (#26),
 * - `dress`   — ke mana meluruskan barisan / siapa pemandu (#26),
 * - `guard`   — alat & hitungan aksen di count sheet Color Guard (#17),
 * - `simbol`  — instruksi visual/tanduk di set (#16),
 * - `lagu`    — urutan lagu, tempo, & sukat (repertoar + set list).
 */
export type JenisSoalShow = 'xcount' | 'dress' | 'guard' | 'simbol' | 'lagu'

export const LABEL_JENIS_SOAL: Record<JenisSoalShow, string> = {
  xcount: 'xCount',
  dress: 'Dress / guide',
  guard: 'Count sheet guard',
  simbol: 'Simbol visual',
  lagu: 'Lagu, tempo & sukat',
}

export interface SoalPilihan {
  id: string
  jenis: JenisSoalShow
  tanya: string
  /** 2–4 pilihan, sudah teracak */
  pilihan: string[]
  /** indeks pilihan yang benar */
  kunci: number
  /** keterangan sesudah dijawab */
  penjelasan: string
}

/**
 * Susun pilihan: jawaban benar + sampai `maks − 1` pengecoh UNIK (beda dari
 * jawaban dan satu sama lain), diacak dengan benih. Benih 0 tetap mengacak
 * secara tetap (bukan acak waktu) — supaya kunci tidak selalu di "A".
 */
export function susunPilihan(benar: string, pengecoh: string[], benih: number, maks = 4): { pilihan: string[]; kunci: number } {
  const unik: string[] = []
  for (const p of pengecoh) {
    const t = p.trim()
    if (t && t !== benar && !unik.includes(t)) unik.push(t)
  }
  const rnd = pembangkitAcak((benih || 0x9e3779b9) ^ hashTeks(benar))
  for (let i = unik.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[unik[i], unik[j]] = [unik[j], unik[i]]
  }
  const pilihan = [benar, ...unik.slice(0, Math.max(1, maks - 1))]
  for (let i = pilihan.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1))
    ;[pilihan[i], pilihan[j]] = [pilihan[j], pilihan[i]]
  }
  return { pilihan, kunci: pilihan.indexOf(benar) }
}

function hashTeks(t: string): number {
  let h = 2166136261
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/** Pengecoh angka hitungan di sekitar `benar`, dijepit 0,5…`maks`. */
function pengecohHitungan(benar: number, maks: number): string[] {
  const calon = [benar - 1, benar + 1, benar - 2, benar + 2, benar + 0.5, benar - 0.5, maks / 2, benar + 3]
  return calon.filter((n) => n > 0 && n <= maks && Math.abs(n - benar) > 0.05).map(fmtHitungan)
}

export interface OpsiKuisShow {
  sets: DrillSet[]
  members: Member[]
  memberId: string
  field: FieldConfig
  countSheets?: CountSheet[]
  sections?: SectionDef[]
  songs?: Song[]
  setlists?: SetList[]
  /** batas soal per jenis (bawaan 6) */
  maksPerJenis?: number
}

/**
 * Bangun soal Kuis Show untuk satu anggota. Urutan: per jenis, mengikuti
 * urutan show. Pengacakan urutan soal dilakukan pemanggil (`acakUrutan`).
 */
export function bangunSoalShow(o: OpsiKuisShow): SoalPilihan[] {
  const maks = o.maksPerJenis ?? 6
  const me = o.members.find((m) => m.id === o.memberId)
  const urut = [...o.sets].sort((a, b) => a.order - b.order)
  const soal: SoalPilihan[] = []
  const tambah = (s: Omit<SoalPilihan, 'pilihan' | 'kunci'> & { benar: string; pengecoh: string[] }) => {
    const { benar, pengecoh, ...isi } = s
    const p = susunPilihan(benar, pengecoh, hashTeks(isi.id))
    if (p.pilihan.length >= 2) soal.push({ ...isi, ...p })
  }

  /* --- xCount --- */
  let n = 0
  for (let i = 0; i + 1 < urut.length && n < maks; i++) {
    const dari = urut[i]
    const ke = urut[i + 1]
    if (!dari.points?.[o.memberId] || !ke.points?.[o.memberId]) continue
    const info = infoXCountPemain({ dari, ke, anggota: o.members, memberId: o.memberId, field: o.field })
    const x = info?.xCounts[0]
    if (!info || !x) continue
    const counts = Math.max(1, dari.counts || 0)
    tambah({
      id: `xcount:${dari.id}:${x.label}`,
      jenis: 'xcount',
      tanya: `${dari.name} → ${ke.name} (${counts} count): pada hitungan ke berapa kamu melintasi ${x.label}?`,
      benar: fmtHitungan(x.hitungan),
      pengecoh: pengecohHitungan(x.hitungan, counts),
      penjelasan: info.teksXCount,
    })
    n++
  }

  /* --- Dress / guide --- */
  n = 0
  for (const set of urut) {
    if (n >= maks) break
    const info = resolusiDress(set, o.memberId, o.members)
    if (!info) continue
    const SENDIRI = 'Kamu sendiri pemandunya'
    const benar = info.diriSendiri ? SENDIRI : info.pemanduKode ? `${info.label} — ikut ${info.pemanduKode}` : info.label
    const kodeLain = Object.keys(set.points)
      .filter((id) => id !== o.memberId && id !== info.pemanduId)
      .map((id) => o.members.find((m) => m.id === id)?.code)
      .filter((k): k is string => !!k)
    const labelLain = Object.values(LABEL_ACUAN_DRESS).filter((l) => l !== info.label && l !== 'Pemandu')
    const pengecoh = [
      ...(info.diriSendiri ? [] : [SENDIRI]),
      ...labelLain.map((l, j) => (info.pemanduKode && kodeLain.length ? `${l} — ikut ${kodeLain[j % kodeLain.length]}` : l)),
    ]
    tambah({
      id: `dress:${set.id}`,
      jenis: 'dress',
      tanya: `Di ${set.name}, ke mana kamu meluruskan barisan (dress/guide)?`,
      benar,
      pengecoh,
      penjelasan: info.teks,
    })
    n++
  }

  /* --- Count sheet Color Guard --- */
  n = 0
  const lembar = me ? countSheetUntukAnggota(o.countSheets ?? [], me) : []
  const semuaAlat = Object.values(LABEL_ALAT_GUARD)
  for (const cs of lembar) {
    for (const b of [...cs.blok].sort((x, y) => x.urutan - y.urutan)) {
      if (n >= maks) break
      const alat = LABEL_ALAT_GUARD[b.alat] ?? b.alat
      tambah({
        id: `guard-alat:${cs.id}:${b.id}`,
        jenis: 'guard',
        tanya: `Count sheet "${cs.judul}", ${b.labelBagian}: alat apa yang kamu pegang?`,
        benar: alat,
        pengecoh: semuaAlat,
        penjelasan: `${b.labelBagian}: ${alat}${b.teknik ? ` — ${b.teknik}` : ''}`,
      })
      n++
      const aksen = (b.aksenCount ?? []).filter((c) => c >= 1 && c <= b.counts)
      if (aksen.length && n < maks) {
        const fmt = (xs: number[]) => xs.join(', ')
        const geser = [-1, 1, -2, 2, 3].map((d) => aksen.map((c) => c + d)).filter((xs) => xs.every((c) => c >= 1 && c <= b.counts))
        tambah({
          id: `guard-aksen:${cs.id}:${b.id}`,
          jenis: 'guard',
          tanya: `Count sheet "${cs.judul}", ${b.labelBagian}: aksen/release jatuh di count berapa?`,
          benar: fmt(aksen),
          pengecoh: geser.map(fmt),
          penjelasan: `Aksen di count ${fmt(aksen)} dari ${b.counts}${b.teknik ? ` (${b.teknik})` : ''}.`,
        })
        n++
      }
    }
  }

  /* --- Simbol visual --- */
  n = 0
  for (const set of urut) {
    if (n >= maks) break
    const v = set.visual
    if (!v?.simbol?.length || !set.points?.[o.memberId]) continue
    if (v.seksi?.length && (!me || !v.seksi.includes(me.section))) continue
    const label = v.simbol.map((id) => infoSimbolVisual(id).label)
    tambah({
      id: `simbol:${set.id}`,
      jenis: 'simbol',
      tanya: `Di ${set.name}, instruksi visual apa yang harus kamu lakukan?`,
      benar: label.join(' + '),
      pengecoh: DAFTAR_SIMBOL_VISUAL.filter((s) => !v.simbol.includes(s.id)).map((s) => s.label),
      penjelasan: `${set.name}: ${v.simbol.map((id) => `${infoSimbolVisual(id).ikon} ${infoSimbolVisual(id).label}`).join(', ')}${v.catatan ? ` — ${v.catatan}` : ''}`,
    })
    n++
  }

  /* --- Lagu: urutan, tempo, sukat --- */
  n = 0
  const lagu = o.songs ?? []
  const byId = new Map(lagu.map((s) => [s.id, s]))
  for (const sl of o.setlists ?? []) {
    const isi = sl.songIds.map((id) => byId.get(id)).filter((s): s is Song => !!s)
    if (isi.length < 2) continue
    for (let i = 0; i < isi.length && n < maks; i++) {
      tambah({
        id: `urutan:${sl.id}:${i}`,
        jenis: 'lagu',
        tanya: `Dalam set list "${sl.name}", lagu ke-${i + 1} adalah…`,
        benar: isi[i].title,
        pengecoh: isi.filter((_, j) => j !== i).map((s) => s.title),
        penjelasan: `Urutan: ${isi.map((s, j) => `${j + 1}. ${s.title}`).join(' · ')}`,
      })
      n++
    }
  }
  const SUKAT_UMUM = ['2/4', '3/4', '4/4', '5/4', '6/8', '7/8', '9/8', '12/8', '2/2']
  let nTempo = 0
  for (const s of lagu) {
    if (nTempo >= maks) break
    const bpm = Math.round(s.bpm)
    if (bpm > 0) {
      const lain = lagu.filter((x) => x.id !== s.id).map((x) => `${Math.round(x.bpm)} BPM`)
      tambah({
        id: `tempo:${s.id}`,
        jenis: 'lagu',
        tanya: `Berapa tempo dasar lagu "${s.title}"?`,
        benar: `${bpm} BPM`,
        pengecoh: [...lain, ...[-12, 12, -24, 24, 8].map((d) => bpm + d).filter((x) => x >= 30).map((x) => `${x} BPM`)],
        penjelasan: `"${s.title}" dimulai di ${bpm} BPM${s.tempoMap?.length ? ` dan punya ${s.tempoMap.length} perubahan tempo` : ''}.`,
      })
      nTempo++
    }
    const sukat = labelBirama(s.tandaBirama ?? dariBeatsLama(s.beats))
    tambah({
      id: `sukat:${s.id}`,
      jenis: 'lagu',
      tanya: `Lagu "${s.title}" bersukat apa?`,
      benar: sukat,
      pengecoh: SUKAT_UMUM,
      penjelasan: `"${s.title}" bersukat ${sukat}.`,
    })
  }
  return soal
}

/** Rekap skor Kuis Show per jenis — untuk layar selesai. */
export function rekapSkorShow(
  soal: SoalPilihan[],
  jawaban: Record<string, number>,
): { jenis: JenisSoalShow; benar: number; total: number }[] {
  const peta = new Map<JenisSoalShow, { benar: number; total: number }>()
  for (const s of soal) {
    if (!(s.id in jawaban)) continue
    const r = peta.get(s.jenis) ?? { benar: 0, total: 0 }
    r.total++
    if (jawaban[s.id] === s.kunci) r.benar++
    peta.set(s.jenis, r)
  }
  return [...peta.entries()].map(([jenis, r]) => ({ jenis, ...r }))
}
