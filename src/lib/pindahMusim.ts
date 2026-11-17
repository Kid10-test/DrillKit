/**
 * v2.10 — Pindah musim yang benar-benar "mulai dari nol", tanpa kehilangan apa pun.
 *
 * Latar belakangnya laporan pemakai: setelah pindah musim, ekspektasinya
 * semua musim lama terekap di arsip, musim baru bersih, anggota nonaktif dulu
 * (yang lanjut tinggal diaktifkan), dan materi/jadwal bisa **dihidupkan
 * kembali satu per satu** bila perlu. Rollover `#21c` meleset di empat hal:
 *
 * 1. **Berkas biner hilang permanen.** `partiturBerkas`, `rekamanAudio`, dan
 *    `judgeTapeAudio` ikut di-`clear()`, padahal arsip hanya menyimpan
 *    metadata lagu. Kini tiga tabel itu **tidak disentuh** saat rollover;
 *    berkasnya tetap di perangkat, terikat ke `songId` / `penilaianId` yang
 *    sama, dan muncul lagi begitu lagunya diambil dari arsip. Berkas baru
 *    dibersihkan ketika arsip terakhir yang merujuknya dihapus
 *    (`berkasYatim`).
 * 2. **Anggota tetap aktif.** Kini semuanya dinonaktifkan (`active: 0`) —
 *    datanya utuh, token QR-nya tetap, dan potret statusnya ikut dibekukan
 *    di arsip.
 * 3. **Pemulihan semua-atau-tidak-sama-sekali** yang menimpa musim berjalan.
 *    Kini ada `rencanaAmbilArsip`: pilih lagu / drill / set list / jadwal,
 *    tambahkan saja (tidak menimpa), dengan rujukan yang ikut terbawa atau
 *    diputus secara terang.
 * 4. **Saldo kas kembali ke nol.** Kini saldo akhir dibawa sebagai transaksi
 *    pembuka musim baru (`transaksiSaldoAwal`).
 *
 * Sengaja murni (tanpa Dexie/React/DOM) supaya bisa diuji di Node.
 */
import type {
  AnotasiPartitur,
  ArsipMusim,
  CountSheet,
  Drill,
  DrillSet,
  Member,
  Session,
  SetList,
  Song,
  TransaksiKasIuran,
} from '../db/types'

/* ------------------------------------------------------------------------ */
/*  Rollover                                                                */
/* ------------------------------------------------------------------------ */

/**
 * Tabel berkas biner yang **dipertahankan** saat rollover. Isinya tidak ikut
 * disalin ke `ArsipMusim` (terlalu besar untuk satu dokumen), jadi satu-satunya
 * cara agar arsip tetap lengkap adalah tidak menghapusnya.
 */
export const TABEL_BERKAS_DIPERTAHANKAN = ['partiturBerkas', 'rekamanAudio', 'judgeTapeAudio'] as const

/** Anggota yang perlu diubah menjadi nonaktif (yang sudah nonaktif dilewati). */
export function nonaktifkanSemua(members: Member[]): Member[] {
  return (members ?? []).filter((m) => m.active !== 0).map((m) => ({ ...m, active: 0 }))
}

/**
 * Transaksi pembuka musim baru yang membawa saldo akhir musim lama.
 *
 * `nominal` di buku kas selalu positif, jadi saldo negatif dibawa sebagai
 * `pengeluaran` ("defisit"), bukan pemasukan bernilai minus. Saldo nol tidak
 * menghasilkan transaksi apa pun.
 */
export function transaksiSaldoAwal(
  saldoAkhir: number,
  namaMusim: string,
  tanggal: string,
  id: string,
  sekarang: number,
): TransaksiKasIuran | null {
  const nilai = Math.round(Number.isFinite(saldoAkhir) ? saldoAkhir : 0)
  if (nilai === 0) return null
  const surplus = nilai > 0
  return {
    id,
    tanggal,
    jenis: surplus ? 'pemasukan_umum' : 'pengeluaran',
    kategoriProgram: surplus ? 'Saldo awal' : 'Defisit musim lalu',
    nominal: Math.abs(nilai),
    nomorKwitansi: 'SALDO-AWAL',
    keterangan: surplus
      ? `Saldo akhir ${namaMusim}, dibawa ke musim baru`
      : `Defisit ${namaMusim}, dibawa ke musim baru`,
    createdAt: sekarang,
    updatedAt: sekarang,
  }
}

/* ------------------------------------------------------------------------ */
/*  Berkas yatim saat arsip dihapus                                          */
/* ------------------------------------------------------------------------ */

export interface RujukanBerkas {
  songIds: Set<string>
  penilaianIds: Set<string>
}

/** Kumpulkan id lagu & penilaian yang masih dirujuk ruang kerja + arsip lain. */
export function kumpulkanRujukanBerkas(
  ruangKerja: { songs: { id: string }[]; penilaianLomba: { id: string }[] },
  arsipLain: ArsipMusim[],
): RujukanBerkas {
  const songIds = new Set<string>()
  const penilaianIds = new Set<string>()
  for (const s of ruangKerja.songs ?? []) songIds.add(s.id)
  for (const p of ruangKerja.penilaianLomba ?? []) penilaianIds.add(p.id)
  for (const a of arsipLain ?? []) {
    for (const s of a.muatanMusim?.songs ?? []) songIds.add(s.id)
    for (const p of a.muatanMusim?.penilaianLomba ?? []) penilaianIds.add(p.id)
  }
  return { songIds, penilaianIds }
}

/**
 * Id berkas yang tidak dirujuk siapa pun lagi setelah sebuah arsip dihapus.
 * Hanya berkas milik lagu/penilaian **di arsip yang dihapus** yang boleh
 * dibersihkan — berkas lain (mis. yang diunggah sebelum lagunya dibuat) tidak
 * disentuh.
 */
export function berkasYatim(
  arsipDihapus: ArsipMusim,
  rujukan: RujukanBerkas,
  berkas: {
    partitur: { id: string; songId: string }[]
    audio: { id: string; songId: string }[]
    judgeTape: { id: string; penilaianId: string }[]
  },
): { partitur: string[]; audio: string[]; judgeTape: string[] } {
  const laguArsip = new Set((arsipDihapus.muatanMusim?.songs ?? []).map((s) => s.id))
  const nilaiArsip = new Set((arsipDihapus.muatanMusim?.penilaianLomba ?? []).map((p) => p.id))
  const yatimLagu = (x: { songId: string }) => laguArsip.has(x.songId) && !rujukan.songIds.has(x.songId)
  return {
    partitur: (berkas.partitur ?? []).filter(yatimLagu).map((x) => x.id),
    audio: (berkas.audio ?? []).filter(yatimLagu).map((x) => x.id),
    judgeTape: (berkas.judgeTape ?? [])
      .filter((x) => nilaiArsip.has(x.penilaianId) && !rujukan.penilaianIds.has(x.penilaianId))
      .map((x) => x.id),
  }
}

/* ------------------------------------------------------------------------ */
/*  Tanggal                                                                  */
/* ------------------------------------------------------------------------ */

const HARI_MS = 86_400_000

function keHari(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Math.round(Date.UTC(y, (m || 1) - 1, d || 1) / HARI_MS)
}

function dariHari(n: number): string {
  return new Date(n * HARI_MS).toISOString().slice(0, 10)
}

/** Geser tanggal ISO sejauh `hari` (boleh negatif). */
export function geserTanggal(iso: string, hari: number): string {
  return dariHari(keHari(iso) + hari)
}

/**
 * Jarak geser (hari) agar sesi paling awal jatuh di `tanggalTarget`.
 *
 * Bila `pertahankanHari`, jaraknya dibulatkan ke kelipatan 7 terdekat supaya
 * pola latihan (mis. Selasa/Kamis/Jumat) tetap jatuh di hari yang sama —
 * sesi pertama mendarat paling jauh 3 hari dari tanggal yang diminta.
 */
export function hitungGeserHari(tanggalAwalLama: string, tanggalTarget: string, pertahankanHari: boolean): number {
  const selisih = keHari(tanggalTarget) - keHari(tanggalAwalLama)
  if (!pertahankanHari) return selisih
  return Math.round(selisih / 7) * 7
}

/* ------------------------------------------------------------------------ */
/*  Ambil dari arsip (tambah saja, tidak menimpa)                            */
/* ------------------------------------------------------------------------ */

export interface PilihanAmbil {
  songIds: string[]
  drillIds: string[]
  setlistIds: string[]
  sessionIds: string[]
}

export interface OpsiAmbil {
  /** Jarak geser tanggal jadwal (hari). */
  geserHari: number
  /** Pembuat id baru untuk sesi (sesi selalu disalin dengan id baru). */
  buatId: (awalan: string) => string
}

export interface RuangKerjaAmbil {
  songIds: Set<string>
  drillIds: Set<string>
  setlistIds: Set<string>
}

export interface RencanaAmbil {
  songs: Song[]
  drills: Drill[]
  sets: DrillSet[]
  setlists: SetList[]
  countSheets: CountSheet[]
  anotasiPartitur: AnotasiPartitur[]
  sessions: Session[]
  /** Judul lagu yang ikut terbawa karena dirujuk drill / set list pilihan. */
  laguIkut: string[]
  /** Butir yang tidak ditulis karena id-nya sudah ada di musim berjalan. */
  sudahAda: string[]
  /** Rujukan yang dikosongkan (mis. sesi menunjuk set list yang tidak diambil). */
  rujukanDiputus: string[]
}

/**
 * Susun apa saja yang akan ditambahkan ke musim berjalan dari satu arsip.
 *
 * Aturannya:
 * - Lagu, drill, dan set list **memakai id lamanya**, supaya berkas partitur
 *   & rekaman yang dipertahankan (terikat ke `songId`) langsung tersambung
 *   lagi. Bila id itu sudah ada di musim berjalan, butirnya dilewati dan
 *   dilaporkan — tidak pernah menimpa.
 * - Drill membawa set-nya; drill & set list membawa lagu yang dirujuknya
 *   (dilaporkan di `laguIkut`), supaya tidak ada rujukan bolong diam-diam.
 * - Lembar hitungan ikut bila drill-nya diambil, atau bila lagunya diambil
 *   dan lembar itu tidak terikat ke drill lain. Anotasi partitur ikut lagunya.
 * - Sesi jadwal selalu disalin dengan **id baru** dan tanggal digeser;
 *   centang checklist dikosongkan, dan jejak pelaksanaan (realisasi, jam
 *   nyata, log repetisi, form presensi) dibuang karena itu milik musim lama.
 *   Seri berulang tetap satu seri (id seri dipetakan ulang).
 */
export function rencanaAmbilArsip(
  arsip: ArsipMusim,
  pilihan: PilihanAmbil,
  ruangKerja: RuangKerjaAmbil,
  opsi: OpsiAmbil,
): RencanaAmbil {
  const m = arsip.muatanMusim
  const laguArsip = new Map((m.songs ?? []).map((s) => [s.id, s]))
  const drillArsip = new Map((m.drills ?? []).map((d) => [d.id, d]))
  const setlistArsip = new Map((m.setlists ?? []).map((s) => [s.id, s]))

  const sudahAda: string[] = []
  const rujukanDiputus: string[] = []

  const drillDiambil = new Map<string, Drill>()
  for (const id of pilihan.drillIds) {
    const d = drillArsip.get(id)
    if (!d) continue
    if (ruangKerja.drillIds.has(id)) {
      sudahAda.push(`Drill "${d.name}"`)
      continue
    }
    drillDiambil.set(id, d)
  }

  const setlistDiambil = new Map<string, SetList>()
  for (const id of pilihan.setlistIds) {
    const s = setlistArsip.get(id)
    if (!s) continue
    if (ruangKerja.setlistIds.has(id)) {
      sudahAda.push(`Set list "${s.name}"`)
      continue
    }
    setlistDiambil.set(id, s)
  }

  // Lagu: pilihan langsung + yang dirujuk drill/set list yang diambil.
  const laguDipilih = new Set(pilihan.songIds)
  const laguPerlu = new Set<string>(pilihan.songIds)
  for (const d of drillDiambil.values()) if (d.songId) laguPerlu.add(d.songId)
  for (const s of setlistDiambil.values()) for (const id of s.songIds ?? []) laguPerlu.add(id)

  const songs: Song[] = []
  const laguIkut: string[] = []
  for (const id of laguPerlu) {
    const s = laguArsip.get(id)
    if (!s) continue
    if (ruangKerja.songIds.has(id)) {
      if (laguDipilih.has(id)) sudahAda.push(`Lagu "${s.title}"`)
      continue
    }
    songs.push({ ...s })
    if (!laguDipilih.has(id)) laguIkut.push(s.title)
  }
  const laguTersedia = new Set([...ruangKerja.songIds, ...songs.map((s) => s.id)])

  const drills: Drill[] = [...drillDiambil.values()].map((d) => ({ ...d }))
  const sets: DrillSet[] = (m.sets ?? []).filter((x) => drillDiambil.has(x.drillId)).map((x) => ({ ...x }))
  const setlists: SetList[] = [...setlistDiambil.values()].map((s) => ({ ...s }))

  const laguBaru = new Set(songs.map((s) => s.id))
  const countSheets: CountSheet[] = (m.countSheets ?? [])
    .filter((c) => (c.drillId ? drillDiambil.has(c.drillId) : !!c.songId && laguBaru.has(c.songId)))
    .map((c) => {
      const salin = { ...c }
      if (salin.songId && !laguTersedia.has(salin.songId)) {
        rujukanDiputus.push(`Lembar hitungan "${c.judul || c.id}" → lagu`)
        salin.songId = undefined
      }
      return salin
    })
  const anotasiPartitur: AnotasiPartitur[] = (m.anotasiPartitur ?? [])
    .filter((a) => laguBaru.has(a.songId))
    .map((a) => ({ ...a }))

  // Sesi jadwal.
  const setlistTersedia = new Set([...ruangKerja.setlistIds, ...setlists.map((s) => s.id)])
  const petaSeri = new Map<string, string>()
  const dipilihSesi = new Set(pilihan.sessionIds)
  const sessions: Session[] = (m.sessions ?? [])
    .filter((s) => dipilihSesi.has(s.id))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : (a.startTime ?? '').localeCompare(b.startTime ?? '')))
    .map((s) => {
      const {
        realisasiLatihan: _realisasi,
        rencanaAwal: _awal,
        jejakPacu: _jejak,
        mulaiNyata: _mulai,
        selesaiNyata: _selesai,
        logRep: _log,
        formPresensi: _form,
        formKeterangan: _ket,
        ...inti
      } = s
      const baru: Session = {
        ...inti,
        id: opsi.buatId('s_'),
        date: geserTanggal(s.date, opsi.geserHari),
        checklist: (s.checklist ?? []).map((c) => ({ ...c, done: 0 })),
        createdAt: Date.now(),
      }
      if (s.seriId) {
        if (!petaSeri.has(s.seriId)) petaSeri.set(s.seriId, opsi.buatId('seri_'))
        baru.seriId = petaSeri.get(s.seriId)
      }
      if (s.setListId && !setlistTersedia.has(s.setListId)) {
        rujukanDiputus.push(`Sesi "${s.title}" (${baru.date}) → set list`)
        baru.setListId = undefined
      }
      return baru
    })

  return { songs, drills, sets, setlists, countSheets, anotasiPartitur, sessions, laguIkut, sudahAda, rujukanDiputus }
}

/** Ringkasan satu baris untuk toast/laporan. */
export function teksRencanaAmbil(r: RencanaAmbil): string {
  const bagian: string[] = []
  if (r.songs.length) bagian.push(`${r.songs.length} lagu`)
  if (r.drills.length) bagian.push(`${r.drills.length} drill`)
  if (r.setlists.length) bagian.push(`${r.setlists.length} set list`)
  if (r.sessions.length) bagian.push(`${r.sessions.length} sesi jadwal`)
  return bagian.length ? bagian.join(', ') : 'tidak ada yang baru'
}
