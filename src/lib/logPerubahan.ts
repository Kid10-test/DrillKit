/**
 * #15b (I1) — Log Perubahan Show Otomatis ("Apa yang berubah di paket ini").
 *
 * Modul murni (tanpa ketergantungan Dexie, React, atau DOM):
 *  1. Mengekstrak foto ringan keadaan show publik (`KeadaanAcuanShow`) —
 *     DIJAMIN tidak memuat data privat anggota (`token`, `phone`, `notes`,
 *     `evaluasi`, `attendance`, `memberNotes`, maupun `setoran` pribadi).
 *  2. Membandingkan dua keadaan show (`lama` vs `baru`) menjadi daftar butir
 *     berbahasa manusia:
 *     - Pergeseran koordinat titik pemain dalam satuan langkah (mengelompokkan
 *       set berurutan seperti "Set 8–11" dan memadatkan kode seperti "T1–T6"),
 *     - Pemecahan set ("Set 14 dipecah menjadi 14 & 14A"), penambahan/penghapusan
 *       set, dan perubahan jumlah hitungan (`counts`),
 *     - Perubahan BPM dasar lagu, perubahan tempo/birama segmen `tempoMap`
 *       ("Tempo Segmen B berubah 132 → 140 BPM"), panjang birama, & partitur,
 *     - Penambahan/perubahan jadwal latihan dan target setoran hafalan (#14).
 *  3. Menentukan apakah suatu butir perubahan menyangkut anggota tertentu
 *     (`kodeTerdampak` / `seksiTerdampak`) agar kartu di Mode Anggota dapat
 *     menyorot perubahan yang berdampak langsung pada titik/seksinya.
 */
import type {
  ButirPerubahanShow,
  Drill,
  DrillSet,
  FieldConfig,
  ItemLogPerubahan,
  KategoriPerubahanShow,
  KeadaanAcuanShow,
  Member,
  RingkasanPerubahanPaket,
  Session,
  ShareBundle,
  Song,
  TargetSetoran,
} from '../db/types'
import { STEP_YD, stepYd } from './field'

export const LABEL_KATEGORI_PERUBAHAN: Record<KategoriPerubahanShow, string> = {
  drill: 'Formasi',
  lagu: 'Lagu',
  jadwal: 'Jadwal',
  target: 'Target Setoran',
}

const AMBANG_GESER_LANGKAH = 0.5

/** Salin hanya bidang publik anggota untuk pemetaan kode & seksi. */
function ringkasAnggotaAcuan(
  members: Pick<Member, 'id' | 'code' | 'name' | 'section'>[],
): Pick<Member, 'id' | 'code' | 'name' | 'section'>[] {
  return members.map((m) => ({
    id: m.id,
    code: m.code,
    name: m.name,
    section: m.section,
  }))
}

/**
 * Ekstrak keadaan acuan show dari koleksi data pelatih maupun paket.
 */
export function ekstrakKeadaanShow(sumber: {
  dibuatAt?: number
  defaultField?: FieldConfig
  members?: Pick<Member, 'id' | 'code' | 'name' | 'section'>[]
  drills?: Drill[]
  sets?: DrillSet[]
  songs?: Song[]
  sessions?: Session[]
  targetSetoran?: TargetSetoran[]
}): KeadaanAcuanShow {
  return {
    dibuatAt: sumber.dibuatAt ?? Date.now(),
    defaultField: sumber.defaultField ? { ...sumber.defaultField } : undefined,
    members: ringkasAnggotaAcuan(sumber.members ?? []),
    drills: (sumber.drills ?? []).map((d) => ({ ...d })),
    sets: (sumber.sets ?? []).map((s) => ({
      ...s,
      points: Object.fromEntries(
        Object.entries(s.points ?? {}).map(([k, p]) => [k, { ...p }]),
      ),
    })),
    songs: (sumber.songs ?? []).map((s) => ({
      ...s,
      tempoMap: (s.tempoMap ?? []).map((tm) => ({ ...tm })),
    })),
    sessions: (sumber.sessions ?? []).map((s) => ({ ...s })),
    targetSetoran: (sumber.targetSetoran ?? []).map((t) => ({ ...t })),
  }
}

/**
 * Ekstrak keadaan show langsung dari sebuah `ShareBundle` (dipakai di Mode Anggota).
 */
export function ekstrakKeadaanDariPaket(bundle: ShareBundle): KeadaanAcuanShow {
  return ekstrakKeadaanShow({
    dibuatAt: bundle.exportedAt,
    defaultField: bundle.team?.defaultField,
    members: bundle.members ?? [],
    drills: bundle.drills ?? [],
    sets: bundle.sets ?? [],
    songs: bundle.songs ?? [],
    sessions: bundle.sessions ?? [],
    targetSetoran: bundle.targetSetoran ?? [],
  })
}

/** Hash FNV-1a 32-bit deterministik untuk mendeteksi apakah isi show berubah. */
function fnv1a(teks: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < teks.length; i += 1) {
    h ^= teks.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

/**
 * Sidik jari struktural keadaan show (mengabaikan `dibuatAt` / cap waktu edit).
 */
export function cicipKeadaanShow(k: KeadaanAcuanShow): string {
  const drills = [...(k.drills ?? [])]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((d) => ({
      id: d.id,
      name: d.name,
      tempo: d.tempo,
      step: d.field?.step,
      customStepYd: d.field?.customStepYd,
      songId: d.songId ?? '',
    }))

  const sets = [...(k.sets ?? [])]
    .sort((a, b) => (a.drillId === b.drillId ? a.order - b.order : a.drillId.localeCompare(b.drillId)))
    .map((s) => ({
      id: s.id,
      drillId: s.drillId,
      order: s.order,
      name: s.name,
      counts: s.counts,
      gerak: s.gerak?.jalur ?? 'lurus',
      pts: Object.entries(s.points ?? {})
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([id, p]) => `${id}:${Math.round(p.x * 100)},${Math.round(p.y * 100)}`),
    }))

  const songs = [...(k.songs ?? [])]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => ({
      id: s.id,
      title: s.title,
      bpm: s.bpm,
      beats: s.beats,
      panjangBirama: s.panjangBirama ?? 0,
      partiturHash: s.partitur?.hash ?? '',
      tm: (s.tempoMap ?? []).map((t) => `${t.label}@${t.measure}=${t.bpm}/${t.beats}`),
    }))

  const sessions = [...(k.sessions ?? [])]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => `${s.id}:${s.date}:${s.startTime ?? ''}-${s.endTime ?? ''}:${s.title}:${s.place ?? ''}`)

  const targets = [...(k.targetSetoran ?? [])]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((t) => `${t.id}:${t.judul}:${t.biramaDari ?? 0}-${t.biramaSampai ?? 0}:${t.tenggat ?? ''}:${(t.sections ?? []).join(',')}`)

  return fnv1a(JSON.stringify({ drills, sets, songs, sessions, targets }))
}

/* --------------------- Pemformat Label & Rentang Kode --------------------- */

/** Bersihkan nama set supaya tidak menghasilkan "Set Set 8". */
function nomorAtauNamaSet(nama: string, indeks: number): string {
  const bersih = (nama || '').trim()
  if (!bersih) return String(indeks + 1)
  const m = /^set\s+(.+)$/i.exec(bersih)
  if (m) {
    // Jika berbentuk "Set 2 — Busur", ambil bagian utamanya ("2") untuk rentang ringkas
    const pendek = /^([0-9]+[A-Za-z]?)\s*[—–-]\s*.+$/.exec(m[1].trim())
    return pendek ? pendek[1] : m[1].trim()
  }
  const pendekLangsung = /^([0-9]+[A-Za-z]?)\s*[—–-]\s*.+$/.exec(bersih)
  return pendekLangsung ? pendekLangsung[1] : bersih
}

function labelRentangSet(awal: string, akhir: string): string {
  if (awal === akhir) {
    return /^set\b/i.test(awal) ? awal : `Set ${awal}`
  }
  return `Set ${awal}–${akhir}`
}

/**
 * Padatkan daftar kode pemain berurutan:
 * `["T1", "T2", "T3", "T4", "T5", "T6"]` -> `"T1–T6"`,
 * `["B1", "B2"]` -> `"B1, B2"`.
 */
export function ringkasKodePemain(daftarKode: string[], maksTampil = 6): string {
  const unik = [...new Set(daftarKode.map((k) => k.trim()).filter(Boolean))]
  if (unik.length === 0) return ''

  const terurai = unik.map((asli) => {
    const m = /^([A-Za-z]+)(\d+)$/.exec(asli)
    return m ? { asli, awalan: m[1].toUpperCase(), angka: Number(m[2]), lebar: m[2].length } : { asli, awalan: '', angka: NaN, lebar: 0 }
  })

  terurai.sort((a, b) => {
    if (a.awalan && b.awalan) {
      if (a.awalan !== b.awalan) return a.awalan.localeCompare(b.awalan)
      return a.angka - b.angka
    }
    return a.asli.localeCompare(b.asli, 'id', { numeric: true })
  })

  const kelompok: string[] = []
  let i = 0
  while (i < terurai.length) {
    const mulai = terurai[i]
    if (!mulai.awalan || !Number.isFinite(mulai.angka)) {
      kelompok.push(mulai.asli)
      i += 1
      continue
    }
    let j = i
    while (
      j + 1 < terurai.length &&
      terurai[j + 1].awalan === mulai.awalan &&
      terurai[j + 1].angka === terurai[j].angka + 1
    ) {
      j += 1
    }
    const panjang = j - i + 1
    if (panjang >= 3) {
      kelompok.push(`${mulai.asli}–${terurai[j].asli}`)
    } else {
      for (let k = i; k <= j; k += 1) kelompok.push(terurai[k].asli)
    }
    i = j + 1
  }

  if (kelompok.length <= maksTampil) return kelompok.join(', ')
  const sisa = unik.length - maksTampil
  return `${kelompok.slice(0, maksTampil).join(', ')} (+${sisa} lainnya)`
}

function formatLangkah(n: number): string {
  const bulat = Math.round(n * 10) / 10
  return Number.isInteger(bulat) ? String(bulat) : bulat.toFixed(1).replace('.', ',')
}

function namaSegmenLagu(label: string, idx: number): string {
  const bersih = (label || '').trim()
  if (!bersih) return `Segmen ${idx + 1}`
  if (/^[A-Za-z0-9]{1,3}$/.test(bersih)) return `Segmen ${bersih}`
  const pendek = /^([A-Za-z0-9]{1,3})\s*[—–-]\s*.+$/.exec(bersih)
  if (pendek) return `Segmen ${pendek[1]}`
  return bersih
}

/* --------------------- Pembanding Utama (Lama vs Baru) -------------------- */

function ukuranLangkahDrillYd(drill: Drill, defaultField?: FieldConfig): number {
  const f = drill.field ?? defaultField
  if (!f) return STEP_YD['8to5']
  return stepYd(f)
}

function bandingkanSatuDrill(
  dLama: Drill,
  dBaru: Drill,
  setLama: DrillSet[],
  setBaru: DrillSet[],
  petaAnggota: Map<string, { code: string; name: string; section: string }>,
  defaultField?: FieldConfig,
): ButirPerubahanShow[] {
  const butir: ButirPerubahanShow[] = []
  const subjek = dBaru.name || 'Drill'

  if (dLama.tempo !== dBaru.tempo && !dBaru.songId) {
    butir.push({
      kategori: 'drill',
      subjek,
      teks: `Tempo dasar drill berubah ${dLama.tempo} → ${dBaru.tempo} BPM`,
    })
  }

  const urutLama = [...setLama].sort((a, b) => a.order - b.order)
  const urutBaru = [...setBaru].sort((a, b) => a.order - b.order)
  const byIdLama = new Map(urutLama.map((s) => [s.id, s]))
  const byIdBaru = new Map(urutBaru.map((s) => [s.id, s]))

  // 1. Deteksi pemecahan set (mis. Set 14 -> Set 14 & Set 14A) serta set baru / dihapus
  const idBaruSudahDilaporkan = new Set<string>()
  for (let idx = 0; idx < urutBaru.length; idx += 1) {
    const s = urutBaru[idx]
    if (!byIdLama.has(s.id)) continue
    const labelInduk = nomorAtauNamaSet(s.name, idx)
    const pecahan: string[] = [labelInduk]
    let k = idx + 1
    while (k < urutBaru.length && !byIdLama.has(urutBaru[k].id)) {
      const labelAnak = nomorAtauNamaSet(urutBaru[k].name, k)
      const polaPecahan = new RegExp(`^${labelInduk.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[A-Za-z]|-\\d+)$`, 'i')
      if (polaPecahan.test(labelAnak)) {
        pecahan.push(labelAnak)
        idBaruSudahDilaporkan.add(urutBaru[k].id)
        k += 1
      } else {
        break
      }
    }
    if (pecahan.length >= 2) {
      butir.push({
        kategori: 'drill',
        subjek,
        teks: `Set ${labelInduk} dipecah menjadi ${pecahan.join(' & ')}`,
      })
    }
  }

  const setDitambah = urutBaru.filter((s) => !byIdLama.has(s.id) && !idBaruSudahDilaporkan.has(s.id))
  if (setDitambah.length > 0) {
    const daftarLabel = setDitambah.map((s) => `Set ${nomorAtauNamaSet(s.name, s.order)}`).slice(0, 5)
    const ekor = setDitambah.length > 5 ? ` (+${setDitambah.length - 5} lainnya)` : ''
    butir.push({
      kategori: 'drill',
      subjek,
      teks: `Set baru ditambahkan: ${daftarLabel.join(', ')}${ekor}`,
    })
  }

  const setDihapus = urutLama.filter((s) => !byIdBaru.has(s.id))
  if (setDihapus.length > 0) {
    const daftarLabel = setDihapus.map((s) => `Set ${nomorAtauNamaSet(s.name, s.order)}`).slice(0, 5)
    const ekor = setDihapus.length > 5 ? ` (+${setDihapus.length - 5} lainnya)` : ''
    butir.push({
      kategori: 'drill',
      subjek,
      teks: `Set dihapus: ${daftarLabel.join(', ')}${ekor}`,
    })
  }

  // 2. Perubahan counts & gaya gerak pada set yang bertahan (kecuali induk pecahan yang memang dibagi hitungannya)
  for (let idx = 0; idx < urutBaru.length; idx += 1) {
    const sb = urutBaru[idx]
    const sl = byIdLama.get(sb.id)
    if (!sl) continue
    const label = nomorAtauNamaSet(sb.name, idx)
    // Lewati perubahan counts bila set tepat setelahnya adalah hasil pecahannya
    const anakSetelah = urutBaru[idx + 1]
    const apakahIndukPecahan = anakSetelah != null && idBaruSudahDilaporkan.has(anakSetelah.id)
    if (sl.counts !== sb.counts && !apakahIndukPecahan) {
      butir.push({
        kategori: 'drill',
        subjek,
        teks: `Set ${label}: hitungan berubah ${sl.counts} → ${sb.counts} count`,
      })
    }
    const gerakLama = sl.gerak?.jalur ?? 'lurus'
    const gerakBaru = sb.gerak?.jalur ?? 'lurus'
    if (gerakLama !== gerakBaru) {
      butir.push({
        kategori: 'drill',
        subjek,
        teks: `Set ${label}: jalur gerak berubah ${gerakLama} → ${gerakBaru}`,
      })
    }
  }

  // 3. Pergeseran titik koordinat pemain dalam satuan langkah (digabung untuk set berurutan yang identik pemainnya)
  const ydPerLangkah = ukuranLangkahDrillYd(dBaru, defaultField)
  interface GeserSet {
    labelSet: string
    kunciPemain: string
    idPemain: string[]
    maksLangkah: number
  }
  const daftarGeser: GeserSet[] = []

  for (let idx = 0; idx < urutBaru.length; idx += 1) {
    const sb = urutBaru[idx]
    const sl = byIdLama.get(sb.id)
    if (!sl) continue
    const label = nomorAtauNamaSet(sb.name, idx)
    const idBergeser: string[] = []
    let maksLangkah = 0

    const semuaId = new Set([...Object.keys(sl.points ?? {}), ...Object.keys(sb.points ?? {})])
    for (const memberId of semuaId) {
      const pl = sl.points?.[memberId]
      const pb = sb.points?.[memberId]
      if (!pl || !pb) continue
      const jarakYd = Math.hypot(pb.x - pl.x, pb.y - pl.y)
      const langkah = ydPerLangkah > 0 ? jarakYd / ydPerLangkah : 0
      if (langkah >= AMBANG_GESER_LANGKAH) {
        idBergeser.push(memberId)
        if (langkah > maksLangkah) maksLangkah = langkah
      }
    }

    if (idBergeser.length > 0) {
      idBergeser.sort()
      daftarGeser.push({
        labelSet: label,
        kunciPemain: idBergeser.join('|'),
        idPemain: idBergeser,
        maksLangkah,
      })
    }
  }

  // Kelompokkan set berurutan dengan himpunan pemain bergeser yang sama
  let g = 0
  while (g < daftarGeser.length) {
    const awal = daftarGeser[g]
    let akhirIdx = g
    let maksRentang = awal.maksLangkah
    while (
      akhirIdx + 1 < daftarGeser.length &&
      daftarGeser[akhirIdx + 1].kunciPemain === awal.kunciPemain
    ) {
      akhirIdx += 1
      if (daftarGeser[akhirIdx].maksLangkah > maksRentang) {
        maksRentang = daftarGeser[akhirIdx].maksLangkah
      }
    }

    const kodeTerdampak: string[] = []
    const seksiSet = new Set<string>()
    for (const id of awal.idPemain) {
      const m = petaAnggota.get(id)
      kodeTerdampak.push(m?.code || m?.name || id)
      if (m?.section) seksiSet.add(m.section)
    }

    const teksSet = labelRentangSet(awal.labelSet, daftarGeser[akhirIdx].labelSet)
    const teksKode = ringkasKodePemain(kodeTerdampak)
    const ketBesar =
      maksRentang > 2
        ? `berubah > 2 langkah (maks ${formatLangkah(maksRentang)} langkah)`
        : `bergeser maks ${formatLangkah(maksRentang)} langkah`

    butir.push({
      kategori: 'drill',
      subjek,
      teks: `${teksSet}: posisi ${teksKode} ${ketBesar}`,
      kodeTerdampak,
      seksiTerdampak: [...seksiSet],
    })

    g = akhirIdx + 1
  }

  return butir
}

function bandingkanSatuLagu(lLama: Song, lBaru: Song): ButirPerubahanShow[] {
  const butir: ButirPerubahanShow[] = []
  const subjek = lBaru.title || 'Lagu'

  if (lLama.bpm !== lBaru.bpm) {
    butir.push({
      kategori: 'lagu',
      subjek,
      teks: `Tempo dasar berubah ${lLama.bpm} → ${lBaru.bpm} BPM`,
    })
  }

  if ((lLama.panjangBirama ?? 0) !== (lBaru.panjangBirama ?? 0) && lBaru.panjangBirama) {
    butir.push({
      kategori: 'lagu',
      subjek,
      teks: lLama.panjangBirama
        ? `Panjang lagu berubah ${lLama.panjangBirama} → ${lBaru.panjangBirama} birama`
        : `Panjang lagu ditetapkan ${lBaru.panjangBirama} birama`,
    })
  }

  const tmLama = lLama.tempoMap ?? []
  const tmBaru = lBaru.tempoMap ?? []
  const byIdTmLama = new Map(tmLama.map((t) => [t.id, t]))
  const byLabelTmLama = new Map(tmLama.map((t) => [(t.label || '').trim().toLowerCase(), t]))
  const dipakaiLama = new Set<string>()

  tmBaru.forEach((tb, idx) => {
    const cocok =
      byIdTmLama.get(tb.id) ??
      (tb.label ? byLabelTmLama.get(tb.label.trim().toLowerCase()) : undefined)
    const namaSeg = namaSegmenLagu(tb.label, idx)
    if (!cocok) {
      butir.push({
        kategori: 'lagu',
        subjek,
        teks: `Segmen baru ditambahkan: ${namaSeg} (birama ${tb.measure}, ${tb.bpm} BPM)`,
      })
      return
    }
    dipakaiLama.add(cocok.id)
    if (cocok.bpm !== tb.bpm) {
      butir.push({
        kategori: 'lagu',
        subjek,
        teks: `Tempo ${namaSeg} berubah ${cocok.bpm} → ${tb.bpm} BPM`,
      })
    }
    if (cocok.measure !== tb.measure) {
      butir.push({
        kategori: 'lagu',
        subjek,
        teks: `Awal ${namaSeg} bergeser birama ${cocok.measure} → ${tb.measure}`,
      })
    }
  })

  for (let i = 0; i < tmLama.length; i += 1) {
    const tl = tmLama[i]
    if (!dipakaiLama.has(tl.id)) {
      butir.push({
        kategori: 'lagu',
        subjek,
        teks: `${namaSegmenLagu(tl.label, i)} dihapus dari peta tempo`,
      })
    }
  }

  const hashLama = lLama.partitur?.hash ?? ''
  const hashBaru = lBaru.partitur?.hash ?? ''
  if (hashBaru && hashBaru !== hashLama) {
    butir.push({
      kategori: 'lagu',
      subjek,
      teks: hashLama ? 'Lembar partitur diperbarui' : `Partitur baru dipasang (${lBaru.partitur?.namaFile ?? 'notasi'})`,
    })
  }

  return butir
}

/**
 * Bandingkan dua keadaan show menjadi `RingkasanPerubahanPaket` berbahasa manusia.
 */
export function bandingkanKeadaanShow(
  lama: KeadaanAcuanShow,
  baru: KeadaanAcuanShow,
  opsi?: {
    labelAcuan?: string
    catatanPelatih?: string
    sekarang?: number
  },
): RingkasanPerubahanPaket {
  const butir: ButirPerubahanShow[] = []

  const petaAnggota = new Map<string, { code: string; name: string; section: string }>()
  for (const m of lama.members ?? []) petaAnggota.set(m.id, m)
  for (const m of baru.members ?? []) petaAnggota.set(m.id, m)

  // 1. Drill & Formasi
  const drillLamaById = new Map((lama.drills ?? []).map((d) => [d.id, d]))
  const drillBaruById = new Map((baru.drills ?? []).map((d) => [d.id, d]))

  const setLamaPerDrill = new Map<string, DrillSet[]>()
  for (const s of lama.sets ?? []) {
    const arr = setLamaPerDrill.get(s.drillId) ?? []
    arr.push(s)
    setLamaPerDrill.set(s.drillId, arr)
  }
  const setBaruPerDrill = new Map<string, DrillSet[]>()
  for (const s of baru.sets ?? []) {
    const arr = setBaruPerDrill.get(s.drillId) ?? []
    arr.push(s)
    setBaruPerDrill.set(s.drillId, arr)
  }

  for (const db of baru.drills ?? []) {
    const dl = drillLamaById.get(db.id)
    const sb = setBaruPerDrill.get(db.id) ?? []
    if (!dl) {
      butir.push({
        kategori: 'drill',
        subjek: db.name || 'Drill baru',
        teks: `Drill baru ditambahkan (${sb.length} set)`,
      })
      continue
    }
    const sl = setLamaPerDrill.get(db.id) ?? []
    butir.push(
      ...bandingkanSatuDrill(dl, db, sl, sb, petaAnggota, baru.defaultField ?? lama.defaultField),
    )
  }
  for (const dl of lama.drills ?? []) {
    if (!drillBaruById.has(dl.id)) {
      butir.push({
        kategori: 'drill',
        subjek: dl.name || 'Drill',
        teks: 'Drill dihapus dari paket',
      })
    }
  }

  // 2. Lagu & Peta Tempo
  const laguLamaById = new Map((lama.songs ?? []).map((s) => [s.id, s]))
  const laguBaruById = new Map((baru.songs ?? []).map((s) => [s.id, s]))

  for (const sb of baru.songs ?? []) {
    const sl = laguLamaById.get(sb.id)
    if (!sl) {
      butir.push({
        kategori: 'lagu',
        subjek: sb.title || 'Lagu baru',
        teks: `Lagu baru ditambahkan (${sb.bpm} BPM)`,
      })
      continue
    }
    butir.push(...bandingkanSatuLagu(sl, sb))
  }
  for (const sl of lama.songs ?? []) {
    if (!laguBaruById.has(sl.id)) {
      butir.push({
        kategori: 'lagu',
        subjek: sl.title || 'Lagu',
        teks: 'Lagu dihapus dari repertoar paket',
      })
    }
  }

  // 3. Jadwal Latihan
  const sesiLamaById = new Map((lama.sessions ?? []).map((s) => [s.id, s]))
  for (const sb of baru.sessions ?? []) {
    const sl = sesiLamaById.get(sb.id)
    const subjek = sb.title || `Latihan ${sb.date}`
    if (!sl) {
      butir.push({
        kategori: 'jadwal',
        subjek,
        teks: `Jadwal baru pada ${sb.date}${sb.startTime ? ` (${sb.startTime})` : ''}`,
      })
      continue
    }
    if (sl.date !== sb.date) {
      butir.push({
        kategori: 'jadwal',
        subjek,
        teks: `Tanggal jadwal digeser ${sl.date} → ${sb.date}`,
      })
    } else if ((sl.startTime ?? '') !== (sb.startTime ?? '') || (sl.endTime ?? '') !== (sb.endTime ?? '')) {
      butir.push({
        kategori: 'jadwal',
        subjek,
        teks: `Waktu jadwal berubah ${sl.startTime ?? '—'} → ${sb.startTime ?? '—'}`,
      })
    }
    if ((sl.place ?? '').trim() !== (sb.place ?? '').trim() && sb.place?.trim()) {
      butir.push({
        kategori: 'jadwal',
        subjek,
        teks: `Lokasi pindah ke ${sb.place.trim()}`,
      })
    }
  }

  // 4. Target Setoran Hafalan (#14)
  const targetLamaById = new Map((lama.targetSetoran ?? []).map((t) => [t.id, t]))
  for (const tb of baru.targetSetoran ?? []) {
    const tl = targetLamaById.get(tb.id)
    const subjek = tb.judul
    const seksiTerdampak = tb.sections && tb.sections.length > 0 ? [...tb.sections] : undefined
    if (!tl) {
      const ketBirama =
        tb.biramaDari != null
          ? ` (birama ${tb.biramaDari}${tb.biramaSampai && tb.biramaSampai !== tb.biramaDari ? `–${tb.biramaSampai}` : ''})`
          : ''
      butir.push({
        kategori: 'target',
        subjek,
        teks: `Target setoran baru ditambahkan${ketBirama}${tb.tenggat ? ` · tenggat ${tb.tenggat}` : ''}`,
        seksiTerdampak,
      })
      continue
    }
    if ((tl.tenggat ?? '') !== (tb.tenggat ?? '') && tb.tenggat) {
      butir.push({
        kategori: 'target',
        subjek,
        teks: tl.tenggat
          ? `Tenggat setoran berubah ${tl.tenggat} → ${tb.tenggat}`
          : `Tenggat setoran ditetapkan ${tb.tenggat}`,
        seksiTerdampak,
      })
    }
    if (tl.biramaDari !== tb.biramaDari || tl.biramaSampai !== tb.biramaSampai) {
      butir.push({
        kategori: 'target',
        subjek,
        teks: `Rentang birama target diperbarui ke ${tb.biramaDari ?? '—'}–${tb.biramaSampai ?? tb.biramaDari ?? '—'}`,
        seksiTerdampak,
      })
    }
  }

  return {
    dibuatAt: opsi?.sekarang ?? Date.now(),
    dibandingkanDariAt: lama.dibuatAt,
    labelAcuan: opsi?.labelAcuan,
    catatanPelatih: opsi?.catatanPelatih?.trim() || undefined,
    butir,
  }
}

/**
 * Bandingkan dua `ShareBundle` secara langsung (dipakai saat HP anggota
 * memperbarui paket dan paket baru tidak menyertakan `perubahanPaket`).
 */
export function bandingkanPaketShow(
  paketLama: ShareBundle,
  paketBaru: ShareBundle,
): RingkasanPerubahanPaket {
  return bandingkanKeadaanShow(
    ekstrakKeadaanDariPaket(paketLama),
    ekstrakKeadaanDariPaket(paketBaru),
    { sekarang: paketBaru.exportedAt },
  )
}

/**
 * Apakah butir perubahan ini berdampak langsung pada anggota `me`?
 * - Untuk perubahan koordinat formasi (`kodeTerdampak` terisi): tepat bila kode anggota ada di dalamnya.
 * - Untuk target setoran khusus seksi (`seksiTerdampak` terisi tanpa `kodeTerdampak`): tepat bila seksinya cocok.
 */
export function apakahButirMenyangkutAnggota(
  butir: ButirPerubahanShow,
  anggota: Pick<Member, 'code' | 'section'> | null | undefined,
): boolean {
  if (!anggota) return false
  if (butir.kodeTerdampak && butir.kodeTerdampak.length > 0) {
    const kode = (anggota.code || '').trim().toUpperCase()
    if (!kode) return false
    return butir.kodeTerdampak.some((k) => k.trim().toUpperCase() === kode)
  }
  if (butir.seksiTerdampak && butir.seksiTerdampak.length > 0) {
    return butir.seksiTerdampak.includes(anggota.section)
  }
  return false
}

/**
 * Pilih acuan pembanding dari riwayat log terbitan:
 * - Bila keadaan saat ini SAMA dengan entri terbaru (`cicip` identik), gunakan
 *   kembali acuan sebelum entri terbaru supaya menekan "Unduh grup" lalu
 *   "Unduh per anggota (ZIP)" dalam sesi yang sama tetap membawa daftar revisi
 *   yang identik (tidak hilang jadi 0 perubahan!).
 * - Bila keadaan saat ini sudah BERUBAH dari entri terbaru, bandingkan terhadap
 *   `terbaru.keadaanSesudah`.
 */
export function pilihAcuanPerubahan(
  keadaanSekarang: KeadaanAcuanShow,
  riwayatLog: ItemLogPerubahan[],
): {
  acuan: KeadaanAcuanShow | null
  labelAcuan?: string
  pakaiUlangEntri?: ItemLogPerubahan
} {
  if (!riwayatLog || riwayatLog.length === 0) {
    return { acuan: null }
  }
  const urut = [...riwayatLog].sort((a, b) => b.dibuatAt - a.dibuatAt)
  const terbaru = urut[0]
  const cicipSekarang = cicipKeadaanShow(keadaanSekarang)

  if (cicipSekarang === terbaru.cicipSesudah) {
    if (terbaru.cicipSebelum && urut.length >= 2) {
      return {
        acuan: urut[1].keadaanSesudah,
        labelAcuan: urut[1].label,
        pakaiUlangEntri: terbaru,
      }
    }
    return {
      acuan: terbaru.keadaanSesudah,
      labelAcuan: terbaru.label,
      pakaiUlangEntri: terbaru,
    }
  }

  return {
    acuan: terbaru.keadaanSesudah,
    labelAcuan: terbaru.label,
  }
}
