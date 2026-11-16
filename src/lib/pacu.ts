/**
 * v2.11 — Pacu v2: perubahan rundown di lapangan.
 *
 * Latihan jarang berjalan persis seperti rundown. Apel molor, satu pos
 * klinik butuh lima menit lagi, hujan membuat satu blok harus dibawa ke
 * pertemuan berikutnya. Modul ini menampung perubahan-perubahan itu tanpa
 * kehilangan dua hal:
 *
 * 1. **Rencana awal.** Dibekukan saat Pacu pertama kali dipakai, lalu
 *    menjadi acuan selisih dan laporan — supaya \"terlambat 10 menit\" tetap
 *    berarti terlambat dari rundown yang disepakati, bukan dari rundown yang
 *    sudah diubah-ubah.
 * 2. **Jejak.** Setiap perubahan (lewati, ubah menit, tambah, pindah, bawa,
 *    koreksi) dicatat dengan jamnya, sehingga laporan realisasi bisa
 *    menjelaskan *mengapa* latihan selesai di jam itu.
 *
 * Semua fungsi **murni**: menerima keadaan sesi, mengembalikan perubahan
 * yang harus ditulis. Komponen yang menulis ke Dexie.
 */
import type { BlokLatihan, JejakPacu, JenisBlok, JenisJejakPacu, RealisasiBlok, RencanaAwal, Session } from '../db/types'
import { formatMenit, posisiLatihan, prioritasBlok, rapikanRealisasi, susunRencana, totalRencana, type PosisiLatihan } from './latihan'

/** Bagian sesi yang dibaca & diubah Pacu. */
export type KeadaanPacu = Pick<Session, 'id' | 'startTime' | 'rencanaLatihan' | 'realisasiLatihan' | 'rencanaAwal' | 'jejakPacu'>

/** Perubahan yang harus ditulis ke sesi. Kunci yang bernilai `undefined` berarti dihapus. */
export type PerubahanPacu = Partial<Pick<Session, 'rencanaLatihan' | 'realisasiLatihan' | 'rencanaAwal' | 'jejakPacu'>>

/** Batas baris jejak per sesi — pengaman supaya satu sesi tidak membengkak. */
export const MAKS_JEJAK = 120

/* --------------------------------- bantu --------------------------------- */

/** "17.30" dari epoch ms, jam perangkat. */
export function jamEpoch(e: number): string {
  const d = new Date(e)
  return `${String(d.getHours()).padStart(2, '0')}.${String(d.getMinutes()).padStart(2, '0')}`
}

/** "17.30" dari menit sejak tengah malam. */
export function jamTitik(m: number): string {
  const t = ((Math.round(m) % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}.${String(t % 60).padStart(2, '0')}`
}

/** "+3", "−2", "0" — selisih menit untuk dibaca sekilas. */
export function tandaSelisih(m: number): string {
  const r = Math.round(m)
  if (r === 0) return '0'
  return r > 0 ? `+${r}` : `−${-r}`
}

function jejak(s: KeadaanPacu, kini: number, jenis: JenisJejakPacu, teks: string, b?: Pick<BlokLatihan, 'id' | 'judul'>): JejakPacu[] {
  const baris: JejakPacu = { waktu: kini, jenis, teks }
  if (b) {
    baris.blokId = b.id
    baris.judul = b.judul
  }
  const lama = s.jejakPacu ?? []
  return [...lama, baris].slice(-MAKS_JEJAK)
}

/** Salinan rencana saat ini — dipakai sekali, sebelum perubahan pertama. */
function bekukan(s: KeadaanPacu, kini: number): RencanaAwal | undefined {
  if (s.rencanaAwal) return undefined
  const blok = s.rencanaLatihan ?? []
  if (!blok.length) return undefined
  return {
    mulai: s.startTime,
    blok: JSON.parse(JSON.stringify(blok)),
    dibekukan: kini,
  }
}

/** Gabungkan pembekuan (bila perlu) ke perubahan. */
function denganBeku(s: KeadaanPacu, kini: number, p: PerubahanPacu): PerubahanPacu {
  const beku = bekukan(s, kini)
  return beku ? { rencanaAwal: beku, ...p } : p
}

const judulKutip = (b: Pick<BlokLatihan, 'judul'>) => `“${b.judul || 'Blok'}”`

/** Indeks blok terakhir yang benar-benar dimulai (bukan dilewati). */
function indeksTerakhirNyata(blok: BlokLatihan[], realisasi: RealisasiBlok[]): number {
  const peta = new Map(realisasi.map((r) => [r.id, r]))
  let i = -1
  blok.forEach((b, k) => {
    const r = peta.get(b.id)
    if (r && !r.dilewati) i = k
  })
  return i
}

/* -------------------------------- tindakan -------------------------------- */

/**
 * Mulai satu blok.
 *
 * - Blok yang masih berjalan **otomatis diselesaikan** pada detik yang sama,
 *   jadi tidak pernah ada dua blok berjalan bersamaan.
 * - Blok yang dimulai di luar urutan **dipindah** tepat sesudah blok terakhir
 *   yang sudah dimulai. Urutan rencana jadi mengikuti urutan kenyataan, dan
 *   blok-blok yang dilompati tetap \"belum\" — masih dihitung ke proyeksi.
 * - Blok yang tadinya dilewati boleh dimulai lagi; tanda lewatinya dibuang.
 */
export function mulaiBlok(s: KeadaanPacu, id: string, kini: number): PerubahanPacu {
  const blokLama = s.rencanaLatihan ?? []
  const b = blokLama.find((x) => x.id === id)
  if (!b) return {}
  let realisasi = rapikanRealisasi(s.realisasiLatihan).map((r) =>
    r.selesai == null && r.id !== id ? { ...r, selesai: Math.max(r.mulai, kini) } : r,
  )
  realisasi = realisasi.filter((r) => r.id !== id)
  let rencana = blokLama
  let log = s.jejakPacu
  const tanpa = blokLama.filter((x) => x.id !== id)
  const asal = blokLama.indexOf(b)
  // Tujuan: blok pertama yang belum punya catatan sesudah blok terakhir yang
  // dimulai. Blok yang dilewati/dibawa di antaranya tetap di tempatnya.
  const tercatat = new Set(realisasi.map((r) => r.id))
  const terakhir = indeksTerakhirNyata(blokLama, realisasi)
  let posisi: number
  if (asal < terakhir)
    posisi = terakhir // sesudah blok terakhir (indeks bergeser satu karena blok ini diambil)
  else {
    let k = terakhir + 1
    while (k < asal && tercatat.has(blokLama[k].id)) k++
    posisi = k
  }
  if (posisi !== asal) {
    rencana = [...tanpa.slice(0, posisi), b, ...tanpa.slice(posisi)]
    log = jejak(s, kini, 'pindah', `${judulKutip(b)} dikerjakan lebih dulu (urutan ${asal + 1} → ${posisi + 1})`, b)
  }
  realisasi.push({ id, mulai: kini, selesai: null })
  const p: PerubahanPacu = { realisasiLatihan: realisasi }
  if (rencana !== blokLama) p.rencanaLatihan = rencana
  if (log !== s.jejakPacu) p.jejakPacu = log
  return denganBeku(s, kini, p)
}

/** Selesaikan blok yang berjalan. */
export function selesaiBlok(s: KeadaanPacu, id: string, kini: number): PerubahanPacu {
  const realisasi = rapikanRealisasi(s.realisasiLatihan).map((r) =>
    r.id === id && r.selesai == null ? { ...r, selesai: Math.max(r.mulai, kini) } : r,
  )
  return { realisasiLatihan: realisasi }
}

/**
 * Lewati blok yang belum dimulai. Hitungan selisih jalan terus: menit blok
 * itu menjadi waktu yang didapat kembali.
 */
export function lewatiBlok(s: KeadaanPacu, id: string, kini: number): PerubahanPacu {
  const b = (s.rencanaLatihan ?? []).find((x) => x.id === id)
  if (!b) return {}
  const lama = rapikanRealisasi(s.realisasiLatihan)
  const ada = lama.find((r) => r.id === id)
  if (ada && !ada.dilewati) return {} // sudah dikerjakan — pakai koreksi
  const realisasi = [...lama.filter((r) => r.id !== id), { id, mulai: kini, selesai: kini, dilewati: true }]
  return denganBeku(s, kini, {
    realisasiLatihan: realisasi,
    jejakPacu: jejak(s, kini, 'lewati', `${judulKutip(b)} dilewati (${b.menit} mnt)`, b),
  })
}

/** Ubah menit satu blok (yang belum selesai). */
export function ubahMenit(s: KeadaanPacu, id: string, menit: number, kini: number): PerubahanPacu {
  const n = Math.round(menit)
  const blok = s.rencanaLatihan ?? []
  const b = blok.find((x) => x.id === id)
  if (!b || !Number.isFinite(n) || n <= 0 || n === b.menit) return {}
  return denganBeku(s, kini, {
    rencanaLatihan: blok.map((x) => (x.id === id ? { ...x, menit: n } : x)),
    jejakPacu: jejak(s, kini, 'ubah-menit', `${judulKutip(b)} ${b.menit} → ${n} mnt`, b),
  })
}

/**
 * Tambah blok darurat. Diletakkan tepat sesudah blok yang berjalan (atau
 * sesudah blok terakhir yang sudah dimulai), jadi langsung menjadi blok
 * berikutnya.
 */
export function tambahBlok(
  s: KeadaanPacu,
  isi: { judul: string; menit: number; jenis?: JenisBlok },
  kini: number,
  buatId: (awalan: string) => string,
): PerubahanPacu {
  const judul = isi.judul.trim()
  const n = Math.round(isi.menit)
  if (!judul || !Number.isFinite(n) || n <= 0) return {}
  const blok = s.rencanaLatihan ?? []
  const realisasi = rapikanRealisasi(s.realisasiLatihan)
  const posisi = indeksTerakhirNyata(blok, realisasi) + 1
  const baru: BlokLatihan = {
    id: buatId('b_'),
    judul,
    jenis: isi.jenis ?? 'lainnya',
    menit: n,
  }
  return denganBeku(s, kini, {
    rencanaLatihan: [...blok.slice(0, posisi), baru, ...blok.slice(posisi)],
    jejakPacu: jejak(s, kini, 'tambah', `Blok tambahan ${judulKutip(baru)} (${n} mnt)`, baru),
  })
}

/**
 * Tukar urutan blok yang belum dikerjakan dengan tetangganya. Hanya di antara
 * blok yang belum punya catatan — yang sudah terjadi tidak bisa ditukar.
 */
export function pindahBlok(s: KeadaanPacu, id: string, arah: -1 | 1, kini: number): PerubahanPacu {
  const blok = s.rencanaLatihan ?? []
  const realisasi = rapikanRealisasi(s.realisasiLatihan)
  const tercatat = new Set(realisasi.map((r) => r.id))
  const i = blok.findIndex((x) => x.id === id)
  if (i < 0 || tercatat.has(id)) return {}
  let j = i + arah
  while (j >= 0 && j < blok.length && tercatat.has(blok[j].id) && realisasi.find((r) => r.id === blok[j].id)?.dilewati) j += arah
  if (j < 0 || j >= blok.length || tercatat.has(blok[j].id)) return {}
  const salin = [...blok]
  ;[salin[i], salin[j]] = [salin[j], salin[i]]
  const b = blok[i]
  const lain = blok[j]
  return denganBeku(s, kini, {
    rencanaLatihan: salin,
    jejakPacu: jejak(
      s,
      kini,
      'pindah',
      `${judulKutip(b)} ${arah < 0 ? 'dimajukan' : 'dimundurkan'}, bertukar dengan ${judulKutip(lain)}`,
      b,
    ),
  })
}

/**
 * Sesi tujuan \"bawa ke sesi berikutnya\": sesi pertama sesudah sesi ini
 * (tanggal lalu jam mulai), diutamakan yang jenisnya latihan.
 */
export function sesiBerikutnya<T extends Pick<Session, 'id' | 'date' | 'startTime' | 'type'>>(
  s: Pick<Session, 'id' | 'date' | 'startTime'>,
  semua: readonly T[] | undefined,
): T | null {
  const kunci = (x: Pick<Session, 'date' | 'startTime'>) => `${x.date} ${x.startTime || '99:99'}`
  const acuan = kunci(s)
  const sesudah = (semua ?? []).filter((x) => x.id !== s.id && kunci(x) > acuan).sort((a, b) => kunci(a).localeCompare(kunci(b)))
  const latihan = sesudah.find((x) => x.type === 'latihan' || x.type === 'section' || x.type === 'gabungan')
  return latihan ?? sesudah[0] ?? null
}

/**
 * Bawa blok yang belum dikerjakan ke sesi lain. Di sesi ini blok tetap ada
 * (ditandai dibawa, jadi laporan masih menyebutnya); di sesi tujuan salinannya
 * ditambahkan di akhir rencana dengan id baru.
 */
export function bawaKeSesi(
  s: KeadaanPacu & Pick<Session, 'title' | 'date'>,
  id: string,
  tujuan: Pick<Session, 'id' | 'title' | 'date' | 'rencanaLatihan'>,
  kini: number,
  buatId: (awalan: string) => string,
): { asal: PerubahanPacu; tujuan: PerubahanPacu } | null {
  const b = (s.rencanaLatihan ?? []).find((x) => x.id === id)
  if (!b || tujuan.id === s.id) return null
  const lama = rapikanRealisasi(s.realisasiLatihan)
  const ada = lama.find((r) => r.id === id)
  if (ada && !ada.dilewati) return null
  const salinan: BlokLatihan = JSON.parse(JSON.stringify(b))
  salinan.id = buatId('b_')
  salinan.dibawaDari = s.id
  const asalTeks = `Dibawa dari ${s.title || 'sesi'} (${tanggalPendek(s.date)})`
  salinan.catatan = salinan.catatan ? `${asalTeks}\n${salinan.catatan}` : asalTeks
  if (salinan.cabang) salinan.cabang = salinan.cabang.map((c) => ({ ...c, id: buatId('j_') }))
  return {
    asal: denganBeku(s, kini, {
      realisasiLatihan: [...lama.filter((r) => r.id !== id), { id, mulai: kini, selesai: kini, dilewati: true, dibawaKe: tujuan.id }],
      jejakPacu: jejak(
        s,
        kini,
        'bawa',
        `${judulKutip(b)} dibawa ke ${tujuan.title || 'sesi berikutnya'} (${tanggalPendek(tujuan.date)})`,
        b,
      ),
    }),
    tujuan: { rencanaLatihan: [...(tujuan.rencanaLatihan ?? []), salinan] },
  }
}

/**
 * Koreksi jam nyata satu blok tanpa menghapus catatan lainnya. Dipakai bila
 * tombol terlambat ditekan, atau lupa ditekan sama sekali (blok tanpa
 * catatan bisa diberi jam belakangan).
 *
 * `selesai` = `null` membuat blok kembali berjalan; blok lain yang sedang
 * berjalan tidak disentuh, dan `rapikanRealisasi` menjaga hanya satu yang
 * berjalan.
 */
export function koreksiBlok(s: KeadaanPacu, id: string, jam: { mulai: number; selesai: number | null }, kini: number): PerubahanPacu {
  const b = (s.rencanaLatihan ?? []).find((x) => x.id === id)
  if (!b || !Number.isFinite(jam.mulai)) return {}
  if (jam.selesai != null && (!Number.isFinite(jam.selesai) || jam.selesai < jam.mulai)) return {}
  const lama = rapikanRealisasi(s.realisasiLatihan)
  const ada = lama.find((r) => r.id === id)
  const sebelum =
    ada && !ada.dilewati
      ? `${jamEpoch(ada.mulai)}–${ada.selesai != null ? jamEpoch(ada.selesai) : '…'}`
      : ada
        ? 'dilewati'
        : 'tanpa catatan'
  const sesudah = `${jamEpoch(jam.mulai)}–${jam.selesai != null ? jamEpoch(jam.selesai) : '…'}`
  if (ada && !ada.dilewati && ada.mulai === jam.mulai && ada.selesai === jam.selesai) return {}
  const realisasi = [...lama.filter((r) => r.id !== id), { id, mulai: jam.mulai, selesai: jam.selesai }]
  return denganBeku(s, kini, {
    realisasiLatihan: realisasi,
    jejakPacu: jejak(s, kini, 'koreksi', `${judulKutip(b)} dikoreksi: ${sebelum} → ${sesudah}`, b),
  })
}

/** Buang catatan satu blok — blok kembali \"belum\". */
export function batalCatat(s: KeadaanPacu, id: string, kini: number): PerubahanPacu {
  const b = (s.rencanaLatihan ?? []).find((x) => x.id === id)
  const lama = rapikanRealisasi(s.realisasiLatihan)
  const ada = lama.find((r) => r.id === id)
  if (!b || !ada) return {}
  const apa = ada.dibawaKe ? 'tanda dibawa' : ada.dilewati ? 'tanda dilewati' : 'catatan jam'
  const realisasi = lama.filter((r) => r.id !== id)
  const p: PerubahanPacu = {
    realisasiLatihan: realisasi,
    jejakPacu: jejak(s, kini, 'batal-catat', `${apa[0].toUpperCase()}${apa.slice(1)} ${judulKutip(b)} dibatalkan`, b),
  }
  // Blok yang batal dilewati berarti akan dikerjakan: bila posisinya sudah
  // terlampaui, ia dipindah menjadi blok berikutnya supaya kembali dihitung.
  if (ada.dilewati) {
    const blok = s.rencanaLatihan ?? []
    const asal = blok.indexOf(b)
    const terakhir = indeksTerakhirNyata(blok, realisasi)
    if (asal < terakhir) {
      const tanpa = blok.filter((x) => x.id !== id)
      p.rencanaLatihan = [...tanpa.slice(0, terakhir), b, ...tanpa.slice(terakhir)]
    }
  }
  return p
}

/**
 * Ulangi pencatatan dari awal: semua catatan jam & rencana awal dibuang.
 * Rencana yang sekarang tetap seperti adanya; jejaknya disimpan.
 */
export function ulangSemua(s: KeadaanPacu, kini: number): PerubahanPacu {
  return {
    realisasiLatihan: [],
    rencanaAwal: undefined,
    jejakPacu: jejak(s, kini, 'ulang', 'Pencatatan diulang dari awal'),
  }
}

/* ------------------------------ usul potong ------------------------------ */

export interface UsulPotong {
  blokId: string
  judul: string
  aksi: 'lewati' | 'kurangi'
  dari: number
  ke: number
  hemat: number
}

export interface HasilUsulPotong {
  usulan: UsulPotong[]
  /** Menit yang berhasil dikejar. */
  hemat: number
  /** Keterlambatan yang tetap tersisa sesudah usulan (blok kunci tidak disentuh). */
  sisa: number
}

/** Blok biasa paling banyak dikurangi separuh, dan tidak di bawah 5 menit. */
const MIN_SISA_BIASA = 5

/**
 * Usulan memotong supaya latihan kembali selesai tepat waktu.
 *
 * Urutannya mengikuti kebiasaan pelatih saat waktu habis:
 * 1. Blok **potong dulu**, dari yang paling akhir — dikurangi, atau dilewati
 *    bila seluruh menitnya dibutuhkan.
 * 2. Blok **biasa**, dari yang paling akhir — hanya dikurangi, paling banyak
 *    separuh, dan sisanya tidak kurang dari 5 menit.
 * 3. Blok **kunci** tidak pernah disentuh. Bila masih kurang, sisanya
 *    dilaporkan apa adanya: itu keputusan pelatih, bukan aplikasi.
 *
 * Hanya blok yang belum dimulai yang diusulkan.
 */
export function usulPotong(pos: Pick<PosisiLatihan, 'baris' | 'geser'>, kelebihan = pos.geser): HasilUsulPotong {
  const perlu = Math.ceil(Math.max(0, kelebihan) - 0.5)
  const usulan: UsulPotong[] = []
  if (perlu <= 0) return { usulan, hemat: 0, sisa: 0 }
  let butuh = perlu
  const belum = pos.baris.filter((b) => b.status === 'belum' && b.menit > 0)
  for (const b of [...belum].reverse()) {
    if (butuh <= 0) break
    if (b.prioritas !== 'potong') continue
    const ambil = Math.min(butuh, b.menit)
    usulan.push({
      blokId: b.id,
      judul: b.judul,
      aksi: ambil >= b.menit ? 'lewati' : 'kurangi',
      dari: b.menit,
      ke: b.menit - ambil,
      hemat: ambil,
    })
    butuh -= ambil
  }
  for (const b of [...belum].reverse()) {
    if (butuh <= 0) break
    if (b.prioritas !== 'biasa') continue
    const maks = Math.min(Math.floor(b.menit / 2), b.menit - MIN_SISA_BIASA)
    if (maks <= 0) continue
    const ambil = Math.min(butuh, maks)
    usulan.push({
      blokId: b.id,
      judul: b.judul,
      aksi: 'kurangi',
      dari: b.menit,
      ke: b.menit - ambil,
      hemat: ambil,
    })
    butuh -= ambil
  }
  // Tampilkan menurut urutan rundown, bukan urutan pencarian.
  const urutan = new Map(pos.baris.map((b, i) => [b.id, i]))
  usulan.sort((a, b) => (urutan.get(a.blokId) ?? 0) - (urutan.get(b.blokId) ?? 0))
  return { usulan, hemat: perlu - butuh, sisa: butuh }
}

/** Terapkan usulan potong sekaligus (satu baris jejak per blok). */
export function terapkanUsulan(s: KeadaanPacu, usulan: readonly UsulPotong[], kini: number): PerubahanPacu {
  let keadaan: KeadaanPacu = { ...s }
  let hasil: PerubahanPacu = {}
  for (const u of usulan) {
    const p = u.aksi === 'lewati' ? lewatiBlok(keadaan, u.blokId, kini) : ubahMenit(keadaan, u.blokId, u.ke, kini)
    keadaan = { ...keadaan, ...p }
    hasil = { ...hasil, ...p }
  }
  return hasil
}

/* ---------------------------- laporan realisasi ---------------------------- */

export interface BarisLaporan {
  no: number
  id: string
  judul: string
  jenis: JenisBlok
  prioritas: ReturnType<typeof prioritasBlok>
  /** Jam & menit menurut rencana awal; `null` = blok tambahan. */
  rencanaMulai: number | null
  rencanaMenit: number | null
  /** Menit rencana terakhir bila diubah di lapangan. */
  menitDiubah: number | null
  nyataMulai: number | null
  nyataSelesai: number | null
  nyataMenit: number | null
  /** Nyata − rencana awal (atau rencana terakhir untuk blok tambahan). */
  selisih: number | null
  status: 'selesai' | 'berjalan' | 'dilewati' | 'dibawa' | 'takTercatat' | 'belum' | 'dihapus'
  tambahan: boolean
}

export interface LaporanRealisasi {
  baris: BarisLaporan[]
  rencanaMulai: number | null
  rencanaSelesai: number | null
  nyataMulai: number | null
  nyataSelesai: number | null
  /** Nyata selesai − rencana selesai. */
  selisihAkhir: number | null
  telatMulai: number | null
  totalJeda: number
  hitung: {
    selesai: number
    dilewati: number
    dibawa: number
    tambahan: number
    belum: number
    takTercatat: number
    dihapus: number
  }
  kunci: { terlaksana: number; total: number }
  jejak: JejakPacu[]
  teks: string
}

export const LABEL_STATUS_LAPORAN: Record<BarisLaporan['status'], string> = {
  selesai: 'Selesai',
  berjalan: 'Berjalan',
  dilewati: 'Dilewati',
  dibawa: 'Dibawa',
  takTercatat: 'Tak tercatat',
  belum: 'Belum',
  dihapus: 'Dihapus',
}

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des']

function tanggalPendek(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return `${HARI[d.getDay()]} ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`
}

/**
 * Laporan realisasi satu sesi: rencana awal berdampingan dengan kenyataan,
 * plus jejak perubahannya. Menggantikan lembar catatan jam di kertas.
 *
 * `pos` adalah hasil `posisiLatihan` untuk sesi yang sama.
 */
export function laporanRealisasi(s: KeadaanPacu & Pick<Session, 'title' | 'date'>, pos: PosisiLatihan): LaporanRealisasi {
  const awal = s.rencanaAwal
  const mulaiAwal = awal ? menitDariJamAman(awal.mulai) : pos.mulaiAcuan
  const susunAwal = awal ? susunRencana(mulaiAwal, awal.blok) : null
  const petaAwal = new Map((susunAwal ?? []).map((b) => [b.id, b]))
  const idKini = new Set(pos.baris.map((b) => b.id))

  const baris: BarisLaporan[] = pos.baris.map((b, i) => {
    const a = susunAwal ? petaAwal.get(b.id) : b
    const tambahan = !!susunAwal && !a
    const rencanaMenit = a ? a.menit : null
    const status: BarisLaporan['status'] = b.status
    const nyataMenit = b.status === 'selesai' || b.status === 'berjalan' ? b.nyataMenit : null
    const acuan = rencanaMenit ?? b.menit
    return {
      no: i + 1,
      id: b.id,
      judul: b.judul,
      jenis: b.jenis,
      prioritas: b.prioritas,
      rencanaMulai: a ? a.mulai : null,
      rencanaMenit,
      menitDiubah: rencanaMenit != null && rencanaMenit !== b.menit ? b.menit : tambahan ? b.menit : null,
      nyataMulai: b.nyataMulai,
      nyataSelesai: b.nyataSelesai,
      nyataMenit,
      selisih: b.status === 'selesai' && nyataMenit != null ? nyataMenit - acuan : null,
      status,
      tambahan,
    }
  })
  for (const a of susunAwal ?? []) {
    if (idKini.has(a.id)) continue
    baris.push({
      no: baris.length + 1,
      id: a.id,
      judul: a.judul,
      jenis: a.jenis,
      prioritas: a.prioritas,
      rencanaMulai: a.mulai,
      rencanaMenit: a.menit,
      menitDiubah: null,
      nyataMulai: null,
      nyataSelesai: null,
      nyataMenit: null,
      selisih: null,
      status: 'dihapus',
      tambahan: false,
    })
  }

  const hitung = {
    selesai: 0,
    dilewati: 0,
    dibawa: 0,
    tambahan: 0,
    belum: 0,
    takTercatat: 0,
    dihapus: 0,
  }
  for (const b of baris) {
    if (b.tambahan) hitung.tambahan++
    if (b.status === 'selesai' || b.status === 'berjalan') hitung.selesai++
    else if (b.status === 'dilewati') hitung.dilewati++
    else if (b.status === 'dibawa') hitung.dibawa++
    else if (b.status === 'belum') hitung.belum++
    else if (b.status === 'takTercatat') hitung.takTercatat++
    else if (b.status === 'dihapus') hitung.dihapus++
  }
  const kunciSemua = baris.filter((b) => b.prioritas === 'kunci' && !b.tambahan)
  const kunci = {
    total: kunciSemua.length,
    terlaksana: kunciSemua.filter((b) => b.status === 'selesai' || b.status === 'berjalan').length,
  }

  const nyata = pos.baris.filter((b) => b.nyataMulai != null)
  const nyataMulai = nyata.length ? Math.min(...nyata.map((b) => b.nyataMulai!)) : null
  const selesaiSemua = nyata.filter((b) => b.nyataSelesai != null)
  const nyataSelesai = selesaiSemua.length && !pos.berjalan ? Math.max(...selesaiSemua.map((b) => b.nyataSelesai!)) : null
  const rencanaMulai = mulaiAwal
  const rencanaSelesai = pos.target
  const selisihAkhir = nyataSelesai != null && rencanaSelesai != null ? nyataSelesai - rencanaSelesai : null

  const jejakSemua = s.jejakPacu ?? []
  const lap: Omit<LaporanRealisasi, 'teks'> = {
    baris,
    rencanaMulai,
    rencanaSelesai,
    nyataMulai,
    nyataSelesai,
    selisihAkhir,
    telatMulai: pos.telatMulai,
    totalJeda: pos.totalJeda,
    hitung,
    kunci,
    jejak: jejakSemua,
  }
  return { ...lap, teks: teksLaporan(s, lap) }
}

function menitDariJamAman(j: string | undefined): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec((j ?? '').trim())
  if (!m) return null
  return Number(m[1]) * 60 + Number(m[2])
}

function teksLaporan(s: Pick<Session, 'title' | 'date'>, l: Omit<LaporanRealisasi, 'teks'>): string {
  const baris: string[] = []
  baris.push(`Laporan realisasi: ${s.title || 'Sesi'} (${tanggalPendek(s.date)})`)
  const rencana =
    l.rencanaMulai != null && l.rencanaSelesai != null ? `${jamTitik(l.rencanaMulai)}–${jamTitik(l.rencanaSelesai)}` : 'tanpa jam'
  const nyata =
    l.nyataMulai != null ? `${jamTitik(l.nyataMulai)}–${l.nyataSelesai != null ? jamTitik(l.nyataSelesai) : '…'}` : 'belum dimulai'
  const akhir =
    l.selisihAkhir == null
      ? ''
      : Math.round(l.selisihAkhir) === 0
        ? ', selesai tepat waktu'
        : Math.round(l.selisihAkhir) > 0
          ? `, selesai terlambat ${formatMenit(l.selisihAkhir)}`
          : `, selesai lebih cepat ${formatMenit(-l.selisihAkhir)}`
  baris.push(`Rencana ${rencana} · nyata ${nyata}${akhir}`)
  const info: string[] = []
  if (l.telatMulai != null && Math.round(l.telatMulai) !== 0) {
    info.push(
      Math.round(l.telatMulai) > 0 ? `mulai terlambat ${formatMenit(l.telatMulai)}` : `mulai lebih awal ${formatMenit(-l.telatMulai)}`,
    )
  }
  if (Math.round(l.totalJeda) > 0) info.push(`jeda antarblok ${formatMenit(l.totalJeda)}`)
  if (info.length) baris.push(info.join(' · ').replace(/^./, (c) => c.toUpperCase()))
  const h = l.hitung
  const jumlah = [
    `${h.selesai} selesai`,
    h.dilewati ? `${h.dilewati} dilewati` : '',
    h.dibawa ? `${h.dibawa} dibawa` : '',
    h.belum ? `${h.belum} belum` : '',
    h.takTercatat ? `${h.takTercatat} tak tercatat` : '',
    h.dihapus ? `${h.dihapus} dihapus` : '',
  ].filter(Boolean)
  baris.push(`${l.baris.length} blok: ${jumlah.join(', ')}${h.tambahan ? ` · ${h.tambahan} blok tambahan` : ''}`)
  if (l.kunci.total) baris.push(`Blok kunci terlaksana ${l.kunci.terlaksana}/${l.kunci.total}`)
  baris.push('')
  for (const b of l.baris) {
    const r =
      b.rencanaMenit == null
        ? `tambahan ${b.menitDiubah ?? '?'}′`
        : `${b.rencanaMulai != null ? jamTitik(b.rencanaMulai) + ' ' : ''}${b.rencanaMenit}′${b.menitDiubah != null ? ` → ${b.menitDiubah}′` : ''}`
    let n: string
    if (b.status === 'selesai' && b.nyataMulai != null && b.nyataSelesai != null) {
      n = `${jamTitik(b.nyataMulai)}–${jamTitik(b.nyataSelesai)} (${Math.round(b.nyataMenit ?? 0)}′, ${tandaSelisih(b.selisih ?? 0)})`
    } else if (b.status === 'berjalan' && b.nyataMulai != null) {
      n = `${jamTitik(b.nyataMulai)}–… (berjalan)`
    } else if (b.status === 'dibawa') {
      n = 'dibawa ke sesi berikutnya'
    } else {
      n = LABEL_STATUS_LAPORAN[b.status].toLowerCase()
    }
    baris.push(`${b.no}. ${b.judul}${b.prioritas === 'kunci' ? ' [kunci]' : ''}: ${r} | ${n}`)
  }
  if (l.jejak.length) {
    baris.push('')
    baris.push('Perubahan:')
    for (const j of l.jejak) baris.push(`- ${jamEpoch(j.waktu)} ${j.teks}`)
  }
  return baris.join('\n')
}

/* ------------------------------ satu pintu ------------------------------ */

/**
 * Hitung posisi Pacu langsung dari sesi: jam nyata hari sesi, acuan rencana
 * awal, dan penanda selesai sesi. Satu-satunya tempat komponen & laporan
 * menyusun bahan `posisiLatihan`, supaya keduanya tidak pernah berbeda.
 */
export function posisiSesi(s: KeadaanPacu & Pick<Session, 'date' | 'selesaiNyata'>, kini: number): PosisiLatihan {
  const mulai = menitDariJamAman(s.startTime)
  const rencana = susunRencana(mulai, s.rencanaLatihan ?? [])
  const nol = tengahMalam(s.date) ?? new Date(kini).setHours(0, 0, 0, 0)
  const awal = s.rencanaAwal
  return posisiLatihan({
    rencana,
    realisasi: s.realisasiLatihan ?? [],
    menit: Math.floor((kini - nol) / 60000),
    kini,
    nol,
    mulaiAcuan: awal ? (menitDariJamAman(awal.mulai) ?? mulai) : mulai,
    totalAcuan: awal ? totalRencana(awal.blok) : undefined,
    selesaiSesi: s.selesaiNyata ?? null,
  })
}

/** Epoch ms pukul 00.00 tanggal "YYYY-MM-DD", jam perangkat. */
export function tengahMalam(tanggal: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec((tanggal ?? '').trim())
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0)
  return Number.isNaN(d.getTime()) ? null : d.getTime()
}

/** Epoch ms dari "HH:MM" pada tanggal sesi; jam sebelum jam mulai sesi dianggap lewat tengah malam. */
export function epochJamSesi(tanggal: string, jam: string, jamMulaiSesi?: string): number | null {
  const nol = tengahMalam(tanggal)
  const m = menitDariJamAman(jam)
  if (nol == null || m == null) return null
  const awal = menitDariJamAman(jamMulaiSesi)
  // Malam camp: jam 01.30 pada sesi yang mulai 19.00 berarti esok dini hari.
  const lewat = awal != null && m < awal - 6 * 60 ? 1440 : 0
  return nol + (m + lewat) * 60000
}
