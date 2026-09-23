/**
 * G1 — run sheet hari lomba.
 *
 * Jadwal (`Session`) selama ini hanya berisi **rentang waktu kosong**: jam
 * berapa sampai jam berapa, di mana. Ia tidak tahu apa yang dibawakan di
 * slot itu. Padahal pada hari lomba, pertanyaan yang paling menentukan
 * justru: **apakah isi penampilan muat di slot waktunya?**
 *
 * Set list yang berdurasi 11 menit di slot 8 menit bukan sekadar
 * ketidaknyamanan — di banyak perlombaan itu berarti penalti atau gugur.
 * Modul ini menjawabnya, dan melaporkannya sebelum hari H.
 *
 * Sengaja **murni** (tidak menyentuh Dexie, React, atau DOM) supaya bisa
 * diuji langsung dari node, seperti `setlist.ts` dan `repertoar.ts`.
 */
import type { ChecklistItem, Session, SessionType, SetList, Song } from '../db/types'
import { hitungSetList } from './setlist'

/** Menit sejak tengah malam. `null` kalau formatnya tidak dikenali. */
export function menitDariJam(jam: string | undefined | null): number | null {
  if (!jam) return null
  const m = /^(\d{1,2}):(\d{2})$/.exec(jam.trim())
  if (!m) return null
  const h = Number(m[1])
  const n = Number(m[2])
  if (h > 23 || n > 59) return null
  return h * 60 + n
}

/** Kebalikan `menitDariJam`, untuk ditampilkan. Menit di luar satu hari digulung. */
export function jamDariMenit(m: number): string {
  const t = ((Math.round(m) % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`
}

/** Lama slot dalam menit. `null` kalau waktunya tidak sah atau terbalik. */
export function lamaSlot(mulai: number | null, selesai: number | null): number | null {
  if (mulai == null || selesai == null) return null
  if (selesai <= mulai) return null
  return selesai - mulai
}

/**
 * Keadaan kecukupan satu baris.
 *
 * - `cukup` — isi pasti muat di slotnya.
 * - `melebihi` — isi lebih panjang dari slot: ini yang bisa menggugurkan.
 * - `takPasti` — ada lagu yang belum diisi panjangnya, jadi totalnya baru
 *   perkiraan. Sengaja dibedakan dari `cukup`, karena "mungkin cukup" dan
 *   "cukup" bukan hal yang sama.
 * - `tanpaIsi` — sesi ini tidak membawakan set list (pemanasan, rapat).
 * - `slotTakSah` — waktunya tidak terbaca, jadi tidak bisa dinilai.
 */
export type StatusRun = 'cukup' | 'melebihi' | 'takPasti' | 'tanpaIsi' | 'slotTakSah'

export interface BarisRun {
  id: string
  judul: string
  jenis: SessionType
  tempat: string
  mulai: number | null
  selesai: number | null
  /** Lama slot dalam menit; `null` kalau waktunya tidak sah. */
  lamaSlot: number | null
  /** Lama isi penampilan dalam detik; `null` kalau tidak ada set list. */
  lamaIsi: number | null
  /** Jumlah lagu dalam set list yang belum diisi panjangnya. */
  tanpaPanjang: number
  namaSetList?: string
  status: StatusRun
  /** Jeda ke baris berikutnya dalam menit. Negatif = bentrok. `null` di akhir. */
  jeda: number | null
  catatan?: string
  checklist: ChecklistItem[]
  setListId?: string
}

export interface RunSheet {
  tanggal: string
  baris: BarisRun[]
  /** Pasangan id yang waktunya tumpang-tindih. */
  bentrok: { a: string; b: string }[]
  /** Total menit slot yang waktunya sah. */
  totalSlot: number
  /** Total detik isi penampilan (hanya yang punya set list). */
  totalIsi: number
  /** Baris yang waktunya tidak terbaca. */
  slotTakSah: string[]
  peringatan: string[]
}

/**
 * Susun run sheet untuk satu tanggal.
 *
 * Baris diurutkan menurut jam mulai; yang waktunya tidak terbaca diletakkan
 * di akhir supaya tidak mengacaukan urutan linimasa (mengurutkan `null` ke
 * depan akan membuat jadwal tampak rusak).
 */
export function susunRunSheet(bahan: {
  tanggal: string
  sessions: Session[]
  setlists: SetList[]
  songs: Song[]
}): RunSheet {
  const { tanggal, sessions, setlists, songs } = bahan
  const hariIni = sessions.filter((s) => s.date === tanggal)

  const baris: BarisRun[] = hariIni.map((s) => {
    const mulai = menitDariJam(s.startTime)
    const selesai = menitDariJam(s.endTime)
    const lama = lamaSlot(mulai, selesai)

    const sl = s.setListId ? setlists.find((x) => x.id === s.setListId) : undefined
    const h = sl ? hitungSetList(sl, songs) : null
    const lamaIsi = sl ? h?.total ?? 0 : null

    let status: StatusRun
    if (lama == null) status = 'slotTakSah'
    else if (!sl) status = 'tanpaIsi'
    else if ((h?.tanpaPanjang ?? 0) > 0) status = 'takPasti'
    else status = (lamaIsi ?? 0) > lama * 60 ? 'melebihi' : 'cukup'

    return {
      id: s.id,
      judul: s.title,
      jenis: s.type,
      tempat: s.place ?? '',
      mulai,
      selesai,
      lamaSlot: lama,
      lamaIsi,
      tanpaPanjang: h?.tanpaPanjang ?? 0,
      namaSetList: sl?.name,
      status,
      jeda: null,
      catatan: s.notes,
      checklist: s.checklist ?? [],
      setListId: s.setListId,
    }
  })

  // Urutkan: yang punya jam di depan, sisanya di belakang sesuai urutan asli.
  const berwaktu = baris.filter((b) => b.mulai != null).sort((a, b) => (a.mulai ?? 0) - (b.mulai ?? 0))
  const tanpaWaktu = baris.filter((b) => b.mulai == null)
  const urut = [...berwaktu, ...tanpaWaktu]

  // Jeda & bentrok dihitung setelah urutan finalnya diketahui.
  const bentrok: { a: string; b: string }[] = []
  for (let i = 0; i < urut.length; i += 1) {
    const cur = urut[i]
    const next = urut[i + 1]
    if (!next || cur.mulai == null || cur.selesai == null || next.mulai == null) {
      cur.jeda = null
      continue
    }
    cur.jeda = next.mulai - cur.selesai
    if (cur.jeda < 0) bentrok.push({ a: cur.id, b: next.id })
  }

  const peringatan: string[] = []
  for (const b of urut) {
    if (b.status === 'melebihi') {
      peringatan.push(
        `“${b.judul}” isinya lebih panjang dari slotnya (${formatDetik(b.lamaIsi ?? 0)} ` +
          `di slot ${b.lamaSlot} menit).`,
      )
    } else if (b.status === 'takPasti' && b.tanpaPanjang > 0) {
      peringatan.push(
        `“${b.judul}” ada ${b.tanpaPanjang} lagu yang belum diisi panjangnya, ` +
          `jadi durasinya baru perkiraan.`,
      )
    }
    if (b.status === 'slotTakSah') {
      peringatan.push(`“${b.judul}” waktunya tidak terbaca, jadi tidak bisa dinilai.`)
    }
  }
  for (const x of bentrok) {
    const a = urut.find((b) => b.id === x.a)
    const b = urut.find((b) => b.id === x.b)
    if (a && b) {
      peringatan.push(
        `“${a.judul}” dan “${b.judul}” waktunya tumpang-tindih ` +
          `(kurang ${Math.abs(a.jeda ?? 0)} menit).`,
      )
    }
  }

  return {
    tanggal,
    baris: urut,
    bentrok,
    totalSlot: urut.reduce((t, b) => t + (b.lamaSlot ?? 0), 0),
    totalIsi: urut.reduce((t, b) => t + (b.lamaIsi ?? 0), 0),
    slotTakSah: urut.filter((b) => b.status === 'slotTakSah').map((b) => b.id),
    peringatan,
  }
}

/** "7:05" atau "1:05:00" — ringkas untuk ditampilkan di samping judul. */
export function formatDetik(d: number): string {
  const t = Math.max(0, Math.round(d))
  const m = Math.floor(t / 60)
  const s = t % 60
  if (m >= 60) {
    const j = Math.floor(m / 60)
    return `${j}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  }
  return `${m}:${String(s).padStart(2, '0')}`
}

/** Jenis sesi yang bisa membawakan set list. */
export const JENIS_BERISI: SessionType[] = ['penampilan', 'gabungan']

export function bisaBerisiSetList(jenis: SessionType): boolean {
  return JENIS_BERISI.includes(jenis)
}

export const LABEL_JENIS: Record<SessionType, string> = {
  latihan: 'Latihan',
  section: 'Section',
  gabungan: 'Gabungan',
  penampilan: 'Penampilan',
  rapat: 'Rapat',
  lainnya: 'Lainnya',
}
