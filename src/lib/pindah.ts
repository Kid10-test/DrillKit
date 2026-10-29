/**
 * Pusat Data — impor & ekspor lintas seluruh fitur.
 *
 * Latar belakangnya: impor/ekspor di aplikasi ini **tersebar di lima tempat
 * dengan lima format berbeda** — backup JSON di Pengaturan, paket show di
 * Berbagi, tukar repertoar di Musik, CSV koordinat di Drill, CSV anggota di
 * Anggota. Pelatih harus hapal tombol mana yang melakukan apa. Dan tiga
 * fitur besar (jadwal, absensi, rekap) hanya bisa **keluar** tanpa bisa
 * **masuk** kembali.
 *
 * Modul ini menampung logika murninya, supaya aturan-aturan yang mudah salah
 * bisa diuji di node tanpa peramban:
 *
 * 1. **Ringkasan bentrokan** — sebelum apa pun ditulis, pemakai melihat
 *    "N baru / M ditimpa". Menimpa tanpa pemberitahuan menghapus suntingan
 *    lokal tanpa jejak.
 * 2. **Pemutus rujukan** — data DrillKit saling merujuk (jadwal menunjuk set
 *    list, absensi menunjuk sesi & anggota, drill menunjuk lagu). Aturan
 *    yang dipilih pemakai: **longgar** — impor saja semuanya, lalu rujukan
 *    yang tidak ketemu dikosongkan dan dilaporkan. Yang penting tidak ada
 *    yang **diam-diam** rusak: setiap rujukan yang diputus tercantum.
 *
 * Sengaja murni (tidak menyentuh Dexie, React, atau DOM).
 */
import type {
  AttendanceRecord,
  CatatanSetoran,
  Drill,
  DrillSet,
  Evaluasi,
  Kemajuan,
  Member,
  MemberNote,
  Session,
  SetList,
  Song,
  TargetSetoran,
} from '../db/types'

export type JenisData =
  | 'anggota'
  | 'jadwal'
  | 'absensi'
  | 'lagu'
  | 'setlist'
  | 'drill'
  | 'set'
  | 'kemajuan'
  | 'catatan'
  | 'evaluasi'
  | 'targetSetoran'
  | 'setoran'

export const URUTAN_JENIS_DATA: JenisData[] = [
  'anggota',
  'jadwal',
  'absensi',
  'lagu',
  'setlist',
  'drill',
  'set',
  'kemajuan',
  'catatan',
  'evaluasi',
  'targetSetoran',
  'setoran',
]

export const LABEL_JENIS_DATA: Record<JenisData, string> = {
  anggota: 'Anggota',
  jadwal: 'Jadwal',
  absensi: 'Absensi',
  lagu: 'Lagu',
  setlist: 'Set list',
  drill: 'Drill',
  set: 'Set formasi',
  kemajuan: 'Kemajuan',
  catatan: 'Catatan anggota',
  evaluasi: 'Evaluasi anggota',
  targetSetoran: 'Target setoran',
  setoran: 'Setoran hafalan',
}

/**
 * Satu berkas pindah. Semua bagian **opsional** — berkas boleh hanya berisi
 * lagu, atau hanya jadwal. Ini yang membedakannya dari backup, yang selalu
 * memuat segalanya.
 */
export interface BerkasPindah {
  format: 'drillkit-data'
  versi: 1
  dibuat: number
  anggota?: Member[]
  jadwal?: Session[]
  absensi?: AttendanceRecord[]
  lagu?: Song[]
  setlist?: SetList[]
  drill?: Drill[]
  set?: DrillSet[]
  kemajuan?: Kemajuan[]
  catatan?: MemberNote[]
  evaluasi?: Evaluasi[]
  targetSetoran?: TargetSetoran[]
  setoran?: CatatanSetoran[]
}

/** Ambil daftar entitas sebuah jenis. Kosong kalau tidak ada. */
export function ambil(berkas: BerkasPindah, jenis: JenisData): unknown[] {
  return (berkas[jenis] as unknown[] | undefined) ?? []
}

/** Tulis daftar entitas sebuah jenis. Dipakai hanya setelah disalin. */
function taruh(berkas: BerkasPindah, jenis: JenisData, daftar: unknown[]): void {
  switch (jenis) {
    case 'anggota': berkas.anggota = daftar as Member[]; break
    case 'jadwal': berkas.jadwal = daftar as Session[]; break
    case 'absensi': berkas.absensi = daftar as AttendanceRecord[]; break
    case 'lagu': berkas.lagu = daftar as Song[]; break
    case 'setlist': berkas.setlist = daftar as SetList[]; break
    case 'drill': berkas.drill = daftar as Drill[]; break
    case 'set': berkas.set = daftar as DrillSet[]; break
    case 'kemajuan': berkas.kemajuan = daftar as Kemajuan[]; break
    case 'catatan': berkas.catatan = daftar as MemberNote[]; break
    case 'evaluasi': berkas.evaluasi = daftar as Evaluasi[]; break
    case 'targetSetoran': berkas.targetSetoran = daftar as TargetSetoran[]; break
    case 'setoran': berkas.setoran = daftar as CatatanSetoran[]; break
  }
}

/** Kumpulan id yang sudah ada di perangkat, per jenis. */
export type YangAda = Partial<Record<JenisData, string[]>>

export interface RingkasanJenis {
  jenis: JenisData
  /** Jumlah entitas dalam berkas. */
  jumlah: number
  /** Yang belum ada di perangkat — akan ditambah. */
  baru: number
  /** Yang sudah ada di perangkat — akan ditimpa. */
  ditimpa: number
}

/** Daftar jenis beserta jumlahnya, hanya yang tidak kosong. */
export function ringkasanBerkas(berkas: BerkasPindah): { jenis: JenisData; jumlah: number }[] {
  return URUTAN_JENIS_DATA.map((jenis) => ({ jenis, jumlah: ambil(berkas, jenis).length })).filter(
    (r) => r.jumlah > 0,
  )
}

/**
 * Hitung apa yang akan terjadi seandainya berkas ini diterapkan.
 *
 * Dipakai untuk **konfirmasi sebelum menulis** — pemakai memilih "tanya
 * dulu" untuk bentrokan, jadi angka ini harus tampil sebelum apa pun
 * berubah, bukan sesudahnya.
 */
export function hitungBentrok(berkas: BerkasPindah, yangAda: YangAda): RingkasanJenis[] {
  return ringkasanBerkas(berkas).map(({ jenis, jumlah }) => {
    const punya = new Set(yangAda[jenis] ?? [])
    const daftar = ambil(berkas, jenis) as { id?: string; key?: string }[]
    let ditimpa = 0
    for (const e of daftar) {
      const kunci = e.id ?? e.key
      if (kunci != null && punya.has(kunci)) ditimpa += 1
    }
    return { jenis, jumlah, baru: jumlah - ditimpa, ditimpa }
  })
}

/** Total entitas dalam berkas, lintas jenis. */
export function totalBerkas(berkas: BerkasPindah): number {
  return ringkasanBerkas(berkas).reduce((t, r) => t + r.jumlah, 0)
}

export interface RujukanPutus {
  jenis: JenisData
  /** Id entitas yang rujukannya diputus. */
  id: string
  /** Nama kolom yang dikosongkan. */
  kolom: string
  /** Nilai rujukan yang tidak ketemu. */
  nilai: string
}

/**
 * Satu aturan rujukan.
 *
 * `target` = jenis yang ditunjuk. Rujukan dianggap sah kalau id-nya ada
 * **entah di berkas yang masuk atau di perangkat** — karena impor yang
 * menyertakan induknya sendiri tidak boleh dianggap putus.
 */
interface AturanRujukan {
  sumber: JenisData
  target: JenisData
  /** Ambil nilai rujukan dari satu entitas (bisa banyak). */
  baca: (e: never) => string[] | string | undefined
  /** Tulis kembali nilai yang sudah disaring. Entitas boleh diubah di tempat. */
  tulis: (e: never, nilai: string[] | string | undefined) => void
}

const ATURAN: AturanRujukan[] = [
  {
    sumber: 'jadwal',
    target: 'setlist',
    baca: (e: Session) => e.setListId,
    tulis: (e: Session, v) => {
      e.setListId = (v as string | undefined) ?? undefined
    },
  },
  {
    sumber: 'absensi',
    target: 'jadwal',
    baca: (e: AttendanceRecord) => e.sessionId,
    tulis: (e: AttendanceRecord, v) => {
      e.sessionId = (v as string | undefined) ?? ''
    },
  },
  {
    sumber: 'absensi',
    target: 'anggota',
    baca: (e: AttendanceRecord) => e.memberId,
    tulis: (e: AttendanceRecord, v) => {
      e.memberId = (v as string | undefined) ?? ''
    },
  },
  {
    sumber: 'catatan',
    target: 'anggota',
    baca: (e: MemberNote) => e.memberId,
    tulis: (e: MemberNote, v) => {
      e.memberId = (v as string | undefined) ?? ''
    },
  },
  {
    sumber: 'evaluasi',
    target: 'anggota',
    baca: (e: Evaluasi) => e.memberId,
    tulis: (e: Evaluasi, v) => {
      e.memberId = (v as string | undefined) ?? ''
    },
  },
  {
    sumber: 'setlist',
    target: 'lagu',
    baca: (e: SetList) => e.songIds,
    tulis: (e: SetList, v) => {
      e.songIds = (v as string[] | undefined) ?? []
    },
  },
  {
    sumber: 'drill',
    target: 'lagu',
    baca: (e: Drill) => e.songId,
    tulis: (e: Drill, v) => {
      e.songId = (v as string | undefined) ?? undefined
    },
  },
  {
    sumber: 'set',
    target: 'drill',
    baca: (e: DrillSet) => e.drillId,
    tulis: (e: DrillSet, v) => {
      e.drillId = (v as string | undefined) ?? ''
    },
  },
  {
    sumber: 'targetSetoran',
    target: 'lagu',
    baca: (e: TargetSetoran) => e.songId,
    tulis: (e: TargetSetoran, v) => {
      e.songId = (v as string | undefined) ?? undefined
    },
  },
  {
    sumber: 'setoran',
    target: 'targetSetoran',
    baca: (e: CatatanSetoran) => e.targetId,
    tulis: (e: CatatanSetoran, v) => {
      e.targetId = (v as string | undefined) ?? ''
    },
  },
  {
    sumber: 'setoran',
    target: 'anggota',
    baca: (e: CatatanSetoran) => e.memberId,
    tulis: (e: CatatanSetoran, v) => {
      e.memberId = (v as string | undefined) ?? ''
    },
  },
]

/** Id yang tersedia untuk sebuah jenis: gabungan berkas & perangkat. */
function kumpulkanId(berkas: BerkasPindah, yangAda: YangAda, jenis: JenisData): Set<string> {
  const s = new Set<string>(yangAda[jenis] ?? [])
  for (const e of ambil(berkas, jenis) as { id?: string; key?: string }[]) {
    const k = e?.id ?? e?.key
    if (k != null) s.add(k)
  }
  return s
}

/**
 * Terapkan aturan **longgar**: impor semuanya, lalu kosongkan rujukan yang
 * tidak ketemu dan laporkan.
 *
 * Alasan aturan ini: menolak berkasnya akan membuat data yang bagus ikut
 * terbuang hanya karena satu rujukannya hilang, dan kehilangan data lebih
 * buruk daripada rujukan yang putus. Tetapi setiap rujukan yang diputus
 * **harus dilaporkan** — rujukan yang diam-diam menghilang akan ketahuan
 * berminggu-minggu kemudian, saat laporannya sudah terlanjur dipakai.
 */
export function putusRujukan(
  berkas: BerkasPindah,
  yangAda: YangAda,
): { berkas: BerkasPindah; putus: RujukanPutus[] } {
  // Salin cukup dalam: hanya entitas yang disentuh aturan yang diganti.
  const hasil: BerkasPindah = { ...berkas }
  for (const j of URUTAN_JENIS_DATA) {
    const daftar = ambil(berkas, j)
    if (daftar.length) taruh(hasil, j, daftar.map((e) => ({ ...(e as object) })))
  }

  const putus: RujukanPutus[] = []

  for (const aturan of ATURAN) {
    const daftar = ambil(hasil, aturan.sumber) as Record<string, unknown>[]
    if (!daftar.length) continue
    const tersedia = kumpulkanId(berkas, yangAda, aturan.target)

    for (const e of daftar) {
      const nilai = aturan.baca(e as never)
      if (nilai == null) continue

      if (typeof nilai === 'string') {
        if (nilai && !tersedia.has(nilai)) {
          putus.push({
            jenis: aturan.sumber,
            id: String(e.id ?? ''),
            kolom: kolomRujukan(aturan.sumber, aturan.target),
            nilai,
          })
          aturan.tulis(e as never, undefined)
        }
        continue
      }

      // Rujukan berbentuk daftar: saring yang tidak ketemu.
      const sah = nilai.filter((v) => tersedia.has(v))
      for (const v of nilai) {
        if (!tersedia.has(v)) {
          putus.push({
            jenis: aturan.sumber,
            id: String(e.id ?? ''),
            kolom: kolomRujukan(aturan.sumber, aturan.target),
            nilai: v,
          })
        }
      }
      if (sah.length !== nilai.length) aturan.tulis(e as never, sah)
    }
  }

  // Kemajuan dikunci oleh id drill — tidak bisa dikosongkan tanpa
  // kehilangan artinya, jadi yang rujukannya putus dibuang seluruhnya.
  const idDrill = kumpulkanId(berkas, yangAda, 'drill')
  const kemajuan = ambil(hasil, 'kemajuan') as Kemajuan[]
  if (kemajuan.length) {
    const sah: Kemajuan[] = []
    for (const k of kemajuan) {
      if (k.key && idDrill.has(k.key)) sah.push(k)
      else putus.push({ jenis: 'kemajuan', id: k.key ?? '', kolom: 'key', nilai: k.key ?? '' })
    }
    if (sah.length !== kemajuan.length) hasil.kemajuan = sah
  }

  return { berkas: hasil, putus }
}

/** Nama kolom yang mudah dibaca pemakai, bukan nama teknisnya. */
function kolomRujukan(sumber: JenisData, target: JenisData): string {
  const peta: Record<string, string> = {
    'jadwal>setlist': 'set list',
    'absensi>jadwal': 'sesi',
    'absensi>anggota': 'anggota',
    'catatan>anggota': 'anggota',
    'setlist>lagu': 'lagu',
    'drill>lagu': 'lagu',
    'set>drill': 'drill',
    'evaluasi>anggota': 'anggota',
    'kemajuan>drill': 'drill',
    'targetSetoran>lagu': 'lagu',
    'setoran>targetSetoran': 'target setoran',
    'setoran>anggota': 'anggota',
  }
  return peta[`${sumber}>${target}`] ?? target
}

/**
 * Baca & periksa berkas pindah dari teks JSON.
 *
 * Mengembalikan `{ ok: false, alasan }` alih-alih melempar, supaya
 * antarmukanya bisa menampilkan pesan yang manusiawi.
 */
export function bacaBerkasPindah(
  teks: string,
): { ok: true; berkas: BerkasPindah } | { ok: false; alasan: string } {
  let data: unknown
  try {
    data = JSON.parse(teks)
  } catch {
    return { ok: false, alasan: 'Berkasnya bukan JSON yang sah.' }
  }
  if (!data || typeof data !== 'object') return { ok: false, alasan: 'Berkasnya kosong.' }
  const d = data as Partial<BerkasPindah>
  if (d.format !== 'drillkit-data') {
    return { ok: false, alasan: 'Ini bukan berkas Data DrillKit.' }
  }
  if (totalBerkas(d as BerkasPindah) === 0) {
    return { ok: false, alasan: 'Berkasnya tidak berisi data apa pun.' }
  }
  return { ok: true, berkas: d as BerkasPindah }
}

/** Ringkas daftar rujukan putus menjadi beberapa kalimat yang bisa dibaca. */
export function ringkasPutus(putus: RujukanPutus[]): string[] {
  const perJenis = new Map<string, number>()
  for (const p of putus) {
    const k = `${LABEL_JENIS_DATA[p.jenis]} → ${p.kolom}`
    perJenis.set(k, (perJenis.get(k) ?? 0) + 1)
  }
  return [...perJenis.entries()].map(([k, n]) => `${k}: ${n} rujukan tidak ketemu, dikosongkan.`)
}
