import type {
  ArahDefileParade,
  DrillPoint,
  Facing,
  FieldConfig,
  GerakSet,
  InstruksiVisualSet,
  Member,
} from '../db/types'
import { M_TO_YD, YD_TO_M, fieldBox, paradeOf, stepYd } from './field'

/**
 * Mesin Murni Mode Kirab / *Street Parade* & *Display* Jalan Raya (#19).
 *
 * Bebas DOM, Dexie, dan React — dapat diuji langsung di Node (`qa/kirab-logika.mjs`)
 * maupun dipanggil oleh editor pelatih, lembar cetak komando, dan Mode Anggota.
 */

export type BlokDefileId = 'gitapati' | 'spanduk' | 'guard' | 'brass' | 'perkusi'

export const LABEL_BLOK_DEFILE: Record<BlokDefileId, string> = {
  gitapati: 'Gitapati / Mayoret',
  spanduk: 'Spanduk / Pataka',
  guard: 'Color Guard',
  brass: 'Brass & Melodi',
  perkusi: 'Battery & Perkusi',
}

export const URUTAN_BLOK_BAKU: BlokDefileId[] = [
  'gitapati',
  'spanduk',
  'guard',
  'brass',
  'perkusi',
]

export interface HasilKesesuaianJalan {
  lebarJalanM: number
  bahuJalanM: number
  lebarEfektifM: number
  jumlahBanjar: number
  jarakAntarBanjarM: number
  lebarBarisanM: number
  sisaKiriKananM: number
  status: 'aman' | 'mepet' | 'meluber'
  pesan: string
}

/**
 * Hitung apakah lebar susunan banjar muat dengan aman di dalam koridor jalan raya.
 */
export function periksaKesesuaianJalan(
  f: FieldConfig,
  jumlahBanjar: number,
  jarakAntarBanjarLangkah = 2,
): HasilKesesuaianJalan {
  const p = paradeOf(f)
  const lebarJalanM = Math.max(1, f.widthYd * YD_TO_M)
  const bahuJalanM = Math.min(lebarJalanM * 0.35, Math.max(0, p.bahuJalanM))
  const lebarEfektifM = Math.max(0.5, lebarJalanM - bahuJalanM * 2)
  const banjar = Math.max(1, Math.round(jumlahBanjar || 1))
  const spasiLangkah = Math.max(0.5, Number.isFinite(jarakAntarBanjarLangkah) ? jarakAntarBanjarLangkah : 2)
  const jarakAntarBanjarM = spasiLangkah * stepYd(f) * YD_TO_M
  const lebarBarisanM = banjar <= 1 ? 0 : (banjar - 1) * jarakAntarBanjarM
  const sisaKiriKananM = (lebarEfektifM - lebarBarisanM) / 2

  let status: HasilKesesuaianJalan['status'] = 'aman'
  let pesan = `Aman — sisa ruang ${sisaKiriKananM.toFixed(2).replace('.', ',')} m di tiap sisi bahu jalan.`
  if (sisaKiriKananM < -1e-4) {
    status = 'meluber'
    pesan = `Melebihi lebar efektif jalan sebesar ${Math.abs(lebarEfektifM - lebarBarisanM).toFixed(2).replace('.', ',')} m! Kurangi jumlah banjar atau persempit spasi.`
  } else if (sisaKiriKananM < 0.35) {
    status = 'mepet'
    pesan = `Mepet tepi jalan (sisa ${Math.max(0, sisaKiriKananM).toFixed(2).replace('.', ',')} m per sisi) — rawan senggolan instrumen/bendera.`
  }

  return {
    lebarJalanM: Math.round(lebarJalanM * 100) / 100,
    bahuJalanM: Math.round(bahuJalanM * 100) / 100,
    lebarEfektifM: Math.round(lebarEfektifM * 100) / 100,
    jumlahBanjar: banjar,
    jarakAntarBanjarM: Math.round(jarakAntarBanjarM * 1000) / 1000,
    lebarBarisanM: Math.round(lebarBarisanM * 100) / 100,
    sisaKiriKananM: Math.round(sisaKiriKananM * 100) / 100,
    status,
    pesan,
  }
}

/**
 * Sarankan jumlah banjar ideal berdasarkan lebar jalan raya agar menyisakan >= 0,45 m ruang aman per sisi.
 */
export function saranJumlahBanjar(f: FieldConfig, jarakAntarBanjarLangkah = 2): number {
  const p = paradeOf(f)
  const lebarJalanM = Math.max(2, f.widthYd * YD_TO_M)
  const bahuM = Math.min(lebarJalanM * 0.35, Math.max(0, p.bahuJalanM))
  const ruangTargetM = Math.max(0.5, lebarJalanM - bahuM * 2 - 0.9)
  const spasiM = Math.max(0.3, jarakAntarBanjarLangkah * stepYd(f) * YD_TO_M)
  const maks = 1 + Math.floor(ruangTargetM / spasiM)
  return Math.max(2, Math.min(10, maks))
}

export interface OpsiSusunParade {
  /** Jumlah kolom banjar melintang jalan (mis. 4, 5, 6) */
  jumlahBanjar?: number
  /** Jarak melintang antar-banjar dalam langkah (bawaan 2 langkah) */
  jarakAntarBanjarLangkah?: number
  /** Jarak depan–belakang antar-saf dalam satu blok dalam langkah (bawaan 2 langkah) */
  jarakAntarSafLangkah?: number
  /** Jarak pemisah antar-blok seksi dalam langkah (bawaan 4 langkah) */
  jarakAntarSeksiLangkah?: number
  /** Jumlah personel pembawa spanduk/pataka di depan Guard (bawaan 0) */
  jumlahSpanduk?: number
  /** Posisi kepala barisan (Saf 1) sepanjang jalan dalam meter dari titik tengah 0 (bawaan +8 m searah defile) */
  posisiKepalaM?: number
  /** Arah defile (mengikuti pengaturan parade lapangan bila dikosongkan) */
  arahDefile?: ArahDefileParade
  /** Urutan blok dari depan ke belakang barisan */
  urutanBlok?: BlokDefileId[]
}

export interface RingkasanSafParade {
  nomorSaf: number
  blok: BlokDefileId
  labelBlok: string
  posisiMajuM: number
  memberIds: string[]
}

export interface HasilSusunParade {
  points: Record<string, DrillPoint>
  ringkasanSaf: RingkasanSafParade[]
  jumlahSaf: number
  jumlahPemain: number
  panjangBarisanM: number
  kesesuaianJalan: HasilKesesuaianJalan
  peringatan: string[]
}

function hadapDefile(arah: ArahDefileParade): Facing {
  return arah === 'kanan-ke-kiri' ? 'left' : 'right'
}

/** Tanda sumbu X internal untuk maju searah defile (`kiri-ke-kanan` menuju `-x`). */
function tandaMajuX(arah: ArahDefileParade): -1 | 1 {
  return arah === 'kanan-ke-kiri' ? 1 : -1
}

/**
 * Tanda sumbu Y internal untuk sisi KIRI barisan dilihat dari sudut pandang pemain.
 * - Saat bergerak `kiri-ke-kanan` (menghadap kanan layar `-x`): tangan kiri pemain berada di ATAS layar (`+y`).
 * - Saat bergerak `kanan-ke-kiri` (menghadap kiri layar `+x`): tangan kiri pemain berada di BAWAH layar (`-y`).
 */
function tandaKiriPemainY(arah: ArahDefileParade): -1 | 1 {
  return arah === 'kanan-ke-kiri' ? -1 : 1
}

/**
 * Susun seluruh anggota aktif ke dalam formasi defile **Banjar × Saf** otomatis:
 * *Gitapati/Mayoret → Spanduk → Color Guard → Brass/Woodwind → Battery/Pit*.
 */
export function susunBarisanParade(
  members: Member[],
  f: FieldConfig,
  opsi: OpsiSusunParade = {},
): HasilSusunParade {
  const p = paradeOf(f)
  const arah = opsi.arahDefile ?? p.arahDefile
  const sYd = stepYd(f)
  const banjar = Math.max(1, Math.round(opsi.jumlahBanjar ?? saranJumlahBanjar(f, opsi.jarakAntarBanjarLangkah ?? 2)))
  const spasiBanjarLkh = Math.max(0.5, opsi.jarakAntarBanjarLangkah ?? 2)
  const spasiSafLkh = Math.max(1, opsi.jarakAntarSafLangkah ?? 2)
  const spasiSeksiLkh = Math.max(spasiSafLkh, opsi.jarakAntarSeksiLangkah ?? 4)
  const jmlSpanduk = Math.max(0, Math.round(opsi.jumlahSpanduk ?? 0))
  const urutan = opsi.urutanBlok?.length ? opsi.urutanBlok : URUTAN_BLOK_BAKU

  const aktif = members
    .filter((m) => m.active !== 0)
    .slice()
    .sort((a, b) => (a.code || a.name).localeCompare(b.code || b.name, 'id', { numeric: true }))

  // Kelompokkan anggota ke blok defile tanpa menduplikasi satu orang pun.
  const terpakai = new Set<string>()
  const ember: Record<BlokDefileId, Member[]> = {
    gitapati: [],
    spanduk: [],
    guard: [],
    brass: [],
    perkusi: [],
  }

  for (const m of aktif) {
    if (m.role === 'drumMajor') {
      ember.gitapati.push(m)
      terpakai.add(m.id)
    }
  }

  if (jmlSpanduk > 0) {
    // Utamakan anggota guard/other/cadangan untuk spanduk, lalu sisanya bila masih kurang.
    const calonSpanduk = [
      ...aktif.filter((m) => !terpakai.has(m.id) && (m.section === 'other' || m.section === 'guard')),
      ...aktif.filter((m) => !terpakai.has(m.id)),
    ]
    for (const m of calonSpanduk) {
      if (ember.spanduk.length >= jmlSpanduk) break
      if (terpakai.has(m.id)) continue
      ember.spanduk.push(m)
      terpakai.add(m.id)
    }
  }

  for (const m of aktif) {
    if (terpakai.has(m.id)) continue
    if (m.section === 'guard') {
      ember.guard.push(m)
    } else if (m.section === 'brass' || m.section === 'woodwind') {
      ember.brass.push(m)
    } else {
      ember.perkusi.push(m)
    }
    terpakai.add(m.id)
  }

  // Bangun daftar saf berurutan beserta jarak langkah kumulatif di belakang Saf 1.
  const safMentah: { blok: BlokDefileId; anggota: Member[]; mundurLangkah: number }[] = []
  let mundurLkh = 0
  let blokSebelumnyaAda = false

  for (const blok of urutan) {
    const daftar = ember[blok]
    if (!daftar || daftar.length === 0) continue
    if (blokSebelumnyaAda) {
      mundurLkh += spasiSeksiLkh
    }
    // Gitapati tampil anggun maksimal 3 orang per saf di kepala barisan; blok lain memakai `banjar`.
    const kapasitasSaf = blok === 'gitapati' ? Math.min(banjar, Math.max(1, Math.min(3, daftar.length))) : banjar
    for (let i = 0; i < daftar.length; i += kapasitasSaf) {
      if (i > 0) mundurLkh += spasiSafLkh
      safMentah.push({
        blok,
        anggota: daftar.slice(i, i + kapasitasSaf),
        mundurLangkah: mundurLkh,
      })
    }
    blokSebelumnyaAda = true
  }

  const panjangBarisanYd = mundurLkh * sYd
  const panjangBarisanM = Math.round(panjangBarisanYd * YD_TO_M * 100) / 100

  // Bila `posisiKepalaM` tidak diisi, tempatkan seluruh barisan simetris di sekitar titik tengah jalan
  // sehingga kepala sedikit di depan 0 m dan ekor di belakang 0 m (siap bergerak melewati Panggung VIP).
  const kepalaDefaultM = Math.min(
    (f.lengthYd * YD_TO_M) / 2 - 2,
    Math.max(4, Math.round((panjangBarisanM / 2) * 10) / 10),
  )
  const posisiKepalaM = opsi.posisiKepalaM !== undefined ? opsi.posisiKepalaM : kepalaDefaultM

  const box = fieldBox(f)
  const marginX = Math.min(1, box.totalLengthYd * 0.03)
  const marginY = Math.min(0.4, box.totalWidthYd * 0.04)
  const arahX = tandaMajuX(arah)
  const kiriY = tandaKiriPemainY(arah)
  const hadap = hadapDefile(arah)

  const points: Record<string, DrillPoint> = {}
  const ringkasanSaf: RingkasanSafParade[] = []
  let adaTerpotongPanjang = false

  safMentah.forEach((s, idx) => {
    const majuM = posisiKepalaM - s.mundurLangkah * sYd * YD_TO_M
    const xTakTerbatas = majuM * M_TO_YD * arahX
    const x = Math.max(box.minX + marginX, Math.min(box.maxX - marginX, xTakTerbatas))
    if (Math.abs(x - xTakTerbatas) > 0.05) adaTerpotongPanjang = true

    const k = s.anggota.length
    const spasiBanjarYd = spasiBanjarLkh * sYd
    s.anggota.forEach((m, j) => {
      // Banjar 1 di sisi kiri pemain -> Banjar K di sisi kanan pemain, simetris terhadap As Jalan (y = 0).
      const offsetDariTengah = ((k - 1) / 2 - j) * spasiBanjarYd * kiriY
      const y = Math.max(box.minY + marginY, Math.min(box.maxY - marginY, offsetDariTengah))
      points[m.id] = {
        x: Math.round(x * 1000) / 1000,
        y: Math.round(y * 1000) / 1000,
        facing: hadap,
      }
    })

    ringkasanSaf.push({
      nomorSaf: idx + 1,
      blok: s.blok,
      labelBlok: LABEL_BLOK_DEFILE[s.blok],
      posisiMajuM: Math.round(majuM * 100) / 100,
      memberIds: s.anggota.map((m) => m.id),
    })
  })

  const kesesuaianJalan = periksaKesesuaianJalan(f, banjar, spasiBanjarLkh)
  const peringatan: string[] = []
  if (kesesuaianJalan.status !== 'aman') {
    peringatan.push(kesesuaianJalan.pesan)
  }
  if (adaTerpotongPanjang || panjangBarisanM > f.lengthYd * YD_TO_M - 4) {
    peringatan.push(
      `Panjang barisan (${panjangBarisanM.toFixed(1).replace('.', ',')} m) mendekati/melebihi panjang segmen kanvas jalan (${(f.lengthYd * YD_TO_M).toFixed(0)} m). Perpanjang ukuran jalan di Pengaturan bila perlu.`,
    )
  }

  return {
    points,
    ringkasanSaf,
    jumlahSaf: ringkasanSaf.length,
    jumlahPemain: Object.keys(points).length,
    panjangBarisanM,
    kesesuaianJalan,
    peringatan,
  }
}

export interface InfoPosisiParadeAnggota {
  nomorSaf: number
  totalSaf: number
  nomorBanjar: number
  totalBanjarDiSaf: number
  posisiMajuM: number
  jarakDariAsM: number
  sisiDariAs: 'as_jalan' | 'depan_as' | 'belakang_as'
  statusVip: 'tanpa_vip' | 'sebelum_vip' | 'di_zona_vip' | 'setelah_vip'
  jarakKeTengahVipM: number
  labelSisiVip: string
}

/**
 * Baca posisi **Saf & Banjar** seorang anggota beserta posisinya terhadap
 * **Panggung Kehormatan / VIP** (dipakai di Mode Anggota & lembar cetak).
 */
export function posisiSafBanjarAnggota(
  points: Record<string, DrillPoint>,
  memberId: string,
  f: FieldConfig,
): InfoPosisiParadeAnggota | null {
  const my = points[memberId]
  if (!my) return null
  const p = paradeOf(f)
  const sYd = stepYd(f)
  const arahX = tandaMajuX(p.arahDefile)
  const kiriY = tandaKiriPemainY(p.arahDefile)

  // Urutkan semua titik dari paling depan defile (maju terbesar) ke paling belakang.
  const entri = Object.entries(points).map(([id, pt]) => ({
    id,
    pt,
    majuYd: pt.x * arahX,
  }))
  entri.sort((a, b) => b.majuYd - a.majuYd)

  // Kelompokkan titik yang sejajar membujur (toleransi 0,48 langkah) menjadi satu Saf.
  const toleransiSafYd = Math.max(0.25, 0.48 * sYd)
  const daftarSaf: { acuanYd: number; item: typeof entri }[] = []
  for (const e of entri) {
    const safTerakhir = daftarSaf[daftarSaf.length - 1]
    if (safTerakhir && Math.abs(safTerakhir.acuanYd - e.majuYd) <= toleransiSafYd) {
      safTerakhir.item.push(e)
    } else {
      daftarSaf.push({ acuanYd: e.majuYd, item: [e] })
    }
  }

  let nomorSaf = 1
  let nomorBanjar = 1
  let totalBanjarDiSaf = 1
  for (let i = 0; i < daftarSaf.length; i++) {
    const saf = daftarSaf[i]
    const adaSaya = saf.item.some((x) => x.id === memberId)
    if (!adaSaya) continue
    nomorSaf = i + 1
    // Urutkan Banjar 1 (paling kiri pemain) -> Banjar K (paling kanan pemain).
    const urutBanjar = saf.item
      .slice()
      .sort((a, b) => b.pt.y * kiriY - a.pt.y * kiriY)
    totalBanjarDiSaf = urutBanjar.length
    nomorBanjar = urutBanjar.findIndex((x) => x.id === memberId) + 1
    break
  }

  const posisiMajuM = Math.round(my.x * arahX * YD_TO_M * 100) / 100
  const jarakDariAsM = Math.round(Math.abs(my.y) * YD_TO_M * 100) / 100
  const sisiDariAs: InfoPosisiParadeAnggota['sisiDariAs'] =
    jarakDariAsM < 0.05 ? 'as_jalan' : my.y < 0 ? 'depan_as' : 'belakang_as'

  const labelSisiVip =
    p.sisiPanggung === 'belakang' ? 'Tepi Belakang (Seberang)' : 'Tepi Depan (Penonton)'

  if (p.panggungAktif !== 1) {
    return {
      nomorSaf,
      totalSaf: daftarSaf.length,
      nomorBanjar,
      totalBanjarDiSaf,
      posisiMajuM,
      jarakDariAsM,
      sisiDariAs,
      statusVip: 'tanpa_vip',
      jarakKeTengahVipM: 0,
      labelSisiVip,
    }
  }

  const vipTengahM = p.posisiPanggungM
  const setengahVipM = p.panjangPanggungM / 2
  const selisihM = Math.round((vipTengahM - posisiMajuM) * 10) / 10
  let statusVip: InfoPosisiParadeAnggota['statusVip'] = 'di_zona_vip'
  if (posisiMajuM < vipTengahM - setengahVipM) statusVip = 'sebelum_vip'
  else if (posisiMajuM > vipTengahM + setengahVipM) statusVip = 'setelah_vip'

  return {
    nomorSaf,
    totalSaf: daftarSaf.length,
    nomorBanjar,
    totalBanjarDiSaf,
    posisiMajuM,
    jarakDariAsM,
    sisiDariAs,
    statusVip,
    jarakKeTengahVipM: selisihM,
    labelSisiVip,
  }
}

/* ========================================================================== */
/*  2. Simulasi Tikungan 90° (Wheel / Gate Turn) & Penghormatan Panggung VIP  */
/* ========================================================================== */

export type ArahBelokTikungan = 'kanan' | 'kiri'

export interface OpsiTikungan90 {
  jumlahBanjar: number
  jarakAntarBanjarLangkah?: number
  jumlahSaf?: number
  jarakAntarSafLangkah?: number
  /** Hitungan per saf untuk menyapu busur 90° (otomatis dihitung bila kosong) */
  hitunganPutarSaf?: number
}

export interface AnalisisTikungan90 {
  radiusLuarLangkah: number
  radiusLuarM: number
  busurLuarLangkah: number
  hitunganSaranPerSaf: number
  hitunganDipakaiPerSaf: number
  rasioLangkahBanjarLuar: number
  hitunganSeluruhBarisan: number
  amanLangkahLuar: boolean
  catatanTeknis: string
}

/**
 * Analisis geometri *wheel turn / gate turn* 90°:
 * banjar terdalam menjadi poros putar (`mark time` / langkah pendek), sedangkan
 * banjar terluar menyapu seperempat lingkaran $\frac{\pi}{2} \cdot R$.
 */
export function hitungTikungan90(f: FieldConfig, opsi: OpsiTikungan90): AnalisisTikungan90 {
  const sM = stepYd(f) * YD_TO_M
  const banjar = Math.max(1, Math.round(opsi.jumlahBanjar))
  const spasiBanjar = Math.max(0.5, opsi.jarakAntarBanjarLangkah ?? 2)
  const saf = Math.max(1, Math.round(opsi.jumlahSaf ?? 6))
  const spasiSaf = Math.max(1, opsi.jarakAntarSafLangkah ?? 2)

  const radiusLuarLangkah = (banjar - 1) * spasiBanjar
  const radiusLuarM = Math.round(radiusLuarLangkah * sM * 100) / 100
  const busurLuarLangkah = Math.round(((Math.PI / 2) * radiusLuarLangkah) * 100) / 100

  // Bulatkan ke kelipatan 4 ketukan agar pas frase musik / cadence perkusi (minimal 4 ketukan).
  const mentahHitungan = Math.max(4, Math.ceil(busurLuarLangkah))
  const hitunganSaranPerSaf = Math.ceil(mentahHitungan / 4) * 4
  const hitunganDipakaiPerSaf = Math.max(4, Math.round(opsi.hitunganPutarSaf ?? hitunganSaranPerSaf))

  const rasioLangkahBanjarLuar =
    radiusLuarLangkah === 0 ? 0 : Math.round((busurLuarLangkah / hitunganDipakaiPerSaf) * 100) / 100
  const amanLangkahLuar = rasioLangkahBanjarLuar <= 1.25
  const hitunganSeluruhBarisan = hitunganDipakaiPerSaf + Math.max(0, saf - 1) * Math.round(spasiSaf)

  const catatanTeknis = amanLangkahLuar
    ? `Banjar poros dalam menahan langkah pendek, banjar terluar menempuh busur ${busurLuarLangkah.toFixed(1).replace('.', ',')} langkah dalam ${hitunganDipakaiPerSaf} hitungan (lebar langkah ${(rasioLangkahBanjarLuar * sM * 100).toFixed(0)} cm/ketuk).`
    : `Langkah banjar terluar terlalu lebar (${(rasioLangkahBanjarLuar * sM * 100).toFixed(0)} cm/ketuk)! Tambah hitungan putar minimal menjadi ${hitunganSaranPerSaf} ketukan.`

  return {
    radiusLuarLangkah,
    radiusLuarM,
    busurLuarLangkah,
    hitunganSaranPerSaf,
    hitunganDipakaiPerSaf,
    rasioLangkahBanjarLuar,
    hitunganSeluruhBarisan,
    amanLangkahLuar,
    catatanTeknis,
  }
}

export interface SetParadeBaru {
  nameSuffix: string
  counts: number
  points: Record<string, DrillPoint>
  notes: string
  gerak?: GerakSet
  visual?: InstruksiVisualSet
}

/**
 * Bangun rangkaian set **Belok Tikungan 90° (*Wheel / Gate Turn*)** dari susunan titik saat ini
 * tanpa merusak urutan Banjar × Saf sedikit pun.
 *
 * Menghasilkan 2 set:
 * 1. **Poros Tikungan** (kepala barisan merapat ke garis poros tikungan)
 * 2. **Selesai Belok 90°** (seluruh saf telah berputar 90° ke kanan/kiri dengan lintasan melengkung halus)
 * Serta mengembalikan `lebarKanvasDisarankanYd` bila pelatih ingin memperluas lebar kanvas simpang.
 */
export function buatSetTikungan90(
  pointsAwal: Record<string, DrillPoint>,
  f: FieldConfig,
  arahBelok: ArahBelokTikungan,
  opsi?: { hitunganPutar?: number; langkahKeluarSetelahBelok?: number },
): { sets: SetParadeBaru[]; analisis: AnalisisTikungan90; lebarSimpangDisarankanYd: number } {
  const ids = Object.keys(pointsAwal)
  const p = paradeOf(f)
  const sYd = stepYd(f)
  const arahX = tandaMajuX(p.arahDefile)
  const kiriY = tandaKiriPemainY(p.arahDefile)

  if (ids.length === 0) {
    return {
      sets: [],
      analisis: hitungTikungan90(f, { jumlahBanjar: 4 }),
      lebarSimpangDisarankanYd: f.widthYd,
    }
  }

  // Ukur rentang membujur (kepala -> ekor) dan melintang (banjar kiri -> kanan) dari formasi saat ini.
  let maksMajuYd = -Infinity
  let minMajuYd = Infinity
  let maksKananYd = -Infinity
  let minKananYd = Infinity

  for (const id of ids) {
    const pt = pointsAwal[id]
    const majuYd = pt.x * arahX
    const kananYd = -pt.y * kiriY // positif = ke kanan pemain
    if (majuYd > maksMajuYd) maksMajuYd = majuYd
    if (majuYd < minMajuYd) minMajuYd = majuYd
    if (kananYd > maksKananYd) maksKananYd = kananYd
    if (kananYd < minKananYd) minKananYd = kananYd
  }

  const lebarFormasiYd = Math.max(0, maksKananYd - minKananYd)
  const panjangFormasiYd = Math.max(0, maksMajuYd - minMajuYd)
  const taksirBanjar = Math.max(2, Math.round(lebarFormasiYd / (2 * sYd)) + 1)
  const taksirSaf = Math.max(1, Math.round(panjangFormasiYd / (2 * sYd)) + 1)
  const analisis = hitungTikungan90(f, {
    jumlahBanjar: taksirBanjar,
    jumlahSaf: taksirSaf,
    hitunganPutarSaf: opsi?.hitunganPutar,
  })

  // Set 1: Maju sedikit (4 langkah) ke garis poros tikungan jika kepala belum di poros.
  const majuKePorosYd = 4 * sYd
  const hitungMasuk = 8
  const pointsPoros: Record<string, DrillPoint> = {}
  const hadapAwal = hadapDefile(p.arahDefile)
  for (const id of ids) {
    const pt = pointsAwal[id]
    pointsPoros[id] = {
      x: Math.round((pt.x + majuKePorosYd * arahX) * 1000) / 1000,
      y: pt.y,
      facing: pt.facing ?? hadapAwal,
    }
  }

  // Poros tikungan terletak pada Saf 1 (maksMajuYd + majuKePorosYd) dan banjar sisi dalam belokan.
  const kepalaPorosMajuYd = maksMajuYd + majuKePorosYd
  const xPoros = kepalaPorosMajuYd * arahX
  // Bila belok kanan, poros berada di tepi kanan barisan (maksKananYd); bila belok kiri, di tepi kiri (minKananYd).
  const kananPorosYd = arahBelok === 'kanan' ? maksKananYd : minKananYd
  const yPoros = -kananPorosYd * kiriY

  // Vektor arah baru setelah belok 90°:
  // - kiri-ke-kanan (`arahX = -1`, `kiriY = +1`):
  //   belok kanan -> menuju bawah layar (`y` negatif, `facing = 'front'`), kanan baru menuju kiri layar (`+x`)
  //   belok kiri  -> menuju atas layar  (`y` positif, `facing = 'back'`),  kanan baru menuju kanan layar (`-x`)
  // - kanan-ke-kiri (`arahX = +1`, `kiriY = -1`):
  //   belok kanan -> menuju atas layar  (`y` positif, `facing = 'back'`),  kanan baru menuju kanan layar (`-x`)
  //   belok kiri  -> menuju bawah layar (`y` negatif, `facing = 'front'`), kanan baru menuju kiri layar (`+x`)
  const tandaMajuBaruY = arahBelok === 'kanan' ? -kiriY : kiriY
  const hadapBaru: Facing = tandaMajuBaruY < 0 ? 'front' : 'back'
  // Vektor "ke kanan pemain" sesudah belok 90°:
  // Rotasi 90° searah jarum jam / berlawanan di bidang (x, y) menjaga urutan banjar kiri->kanan utuh!
  const tandaKananBaruX = arahBelok === 'kanan' ? -arahX : arahX

  const keluarYd = Math.max(2, opsi?.langkahKeluarSetelahBelok ?? 4) * sYd
  const pointsBelok: Record<string, DrillPoint> = {}
  let rentangMutlakY = f.widthYd / 2

  for (const id of ids) {
    const pt = pointsPoros[id]
    // Jarak saf di belakang kepala barisan (>= 0)
    const dBelakangKepalaYd = kepalaPorosMajuYd - pt.x * arahX
    // Jarak dari banjar poros ke arah luar belokan (>= 0)
    const kananPemainYd = -pt.y * kiriY
    const dDariPorosKananYd = kananPemainYd - kananPorosYd // <= 0 bila poros di kanan, >= 0 bila poros di kiri

    const xBaru = xPoros + dDariPorosKananYd * tandaKananBaruX
    const yBaru = yPoros + (keluarYd - dBelakangKepalaYd) * tandaMajuBaruY
    if (Math.abs(yBaru) + 2 > rentangMutlakY) {
      rentangMutlakY = Math.abs(yBaru) + 2
    }
    pointsBelok[id] = {
      x: Math.round(xBaru * 1000) / 1000,
      y: Math.round(yBaru * 1000) / 1000,
      facing: hadapBaru,
    }
  }

  const labelArah = arahBelok === 'kanan' ? 'Kanan' : 'Kiri'
  const gerakBelok: GerakSet = {
    jalur: 'lengkung',
    lengkung: arahBelok === 'kanan' ? 0.42 : -0.42,
    mudah: 'halus',
  }

  // Ingat konvensi DrillSet: `counts` dan `gerak` pada Set[i] mengatur perpindahan MENUJU Set[i+1]!
  const sets: SetParadeBaru[] = [
    {
      nameSuffix: 'Poros',
      counts: analisis.hitunganSeluruhBarisan,
      points: pointsPoros,
      gerak: gerakBelok,
      notes: `Masuk garis poros tikungan ${labelArah} lalu sapu Wheel/Gate Turn 90° (${analisis.hitunganDipakaiPerSaf} hitungan/saf).`,
    },
    {
      nameSuffix: `Belok${labelArah}`,
      counts: Math.max(8, hitungMasuk),
      points: pointsBelok,
      notes: `Selesai belok 90° ke ${labelArah} — susunan Banjar × Saf tetap utuh. ${analisis.catatanTeknis}`,
    },
  ]

  return {
    sets,
    analisis,
    lebarSimpangDisarankanYd: Math.max(f.widthYd, Math.ceil(rentangMutlakY * 2)),
  }
}

export type ModePenghormatanVip = 'hormat_jalan' | 'display_buka_tutup'

/**
 * Bangun set **Penghormatan VIP** atau **Display Singkat Panggung Kehormatan → Kembali Defile**
 * tanpa membubarkan urutan defile asli!
 */
export function buatSetPenghormatanVip(
  pointsAwal: Record<string, DrillPoint>,
  f: FieldConfig,
  mode: ModePenghormatanVip,
  members: Member[],
  opsi?: { hitunganDisplay?: number },
): SetParadeBaru[] {
  const ids = Object.keys(pointsAwal)
  if (ids.length === 0) return []

  const p = paradeOf(f)
  const sYd = stepYd(f)
  const box = fieldBox(f)
  const marginX = Math.min(1, box.totalLengthYd * 0.03)
  const marginY = Math.min(0.45, box.totalWidthYd * 0.05)
  const arahX = tandaMajuX(p.arahDefile)
  const hadapJalan = hadapDefile(p.arahDefile)
  const hadapVip: Facing = p.sisiPanggung === 'belakang' ? 'back' : 'front'

  // Hitung titik tengah membujur barisan saat ini agar digeser pas ke depan `posisiPanggungM`.
  let minMajuYd = Infinity
  let maksMajuYd = -Infinity
  for (const id of ids) {
    const majuYd = pointsAwal[id].x * arahX
    if (majuYd < minMajuYd) minMajuYd = majuYd
    if (majuYd > maksMajuYd) maksMajuYd = majuYd
  }
  const tengahAwalMajuYd = (minMajuYd + maksMajuYd) / 2
  const targetVipMajuYd = p.posisiPanggungM * M_TO_YD
  const geserKeVipYd = targetVipMajuYd - tengahAwalMajuYd
  const hitunganMajuVip = Math.max(8, Math.ceil(Math.abs(geserKeVipYd) / sYd / 4) * 4)

  const pointsDepanVip: Record<string, DrillPoint> = {}
  for (const id of ids) {
    const pt = pointsAwal[id]
    const xBaru = Math.max(box.minX + marginX, Math.min(box.maxX - marginX, pt.x + geserKeVipYd * arahX))
    pointsDepanVip[id] = {
      x: Math.round(xBaru * 1000) / 1000,
      y: pt.y,
      facing: hadapJalan,
    }
  }

  const labelSisiVip = p.sisiPanggung === 'belakang' ? 'Kiri/Belakang' : 'Kanan/Depan'
  const visualHormat: InstruksiVisualSet = {
    simbol: ['hadap_depan', 'horn_up'],
    catatan: `Penghormatan ${p.labelPanggung} (${labelSisiVip}) — kepala & instrumen menghormat ke tribun juri, jaga lurus banjar & saf!`,
  }

  if (mode === 'hormat_jalan') {
    return [
      {
        nameSuffix: 'HormatVIP',
        counts: hitunganMajuVip,
        points: pointsDepanVip,
        visual: visualHormat,
        notes: `Defile Hormat Jalan melintasi ${p.labelPanggung} tanpa menghentikan barisan.`,
      },
    ]
  }

  // Mode `display_buka_tutup`:
  // 1) Masuk Zona Panggung VIP (urutan defile utuh)
  // 2) Buka Display Menghadap Panggung VIP (Gitapati di podium VIP, Guard di sayap kiri-kanan, Brass di saf depan resonan, Perkusi di belakang tengah)
  // 3) Tutup Kembali ke Urutan Defile Asli & lanjut maju 6 langkah!
  const petaMember = new Map(members.map((m) => [m.id, m]))
  const xVipPusat = targetVipMajuYd * arahX
  const bentangVipYd = Math.min(box.totalLengthYd - 2 * marginX, Math.max(8 * sYd, p.panjangPanggungM * M_TO_YD * 0.85))
  const bahuYd = p.bahuJalanM * M_TO_YD
  const setengahLebarAmanYd = Math.max(1.2, f.widthYd / 2 - bahuYd - marginY)
  // Tanda menuju sisi VIP: bila VIP di `'depan'` (`y < 0`), maju ke arah VIP = `-1`; bila di `'belakang'`, `+1`.
  const arahKeVipY = p.sisiPanggung === 'belakang' ? 1 : -1

  const dmIds: string[] = []
  const guardIds: string[] = []
  const brassIds: string[] = []
  const perkusiIds: string[] = []

  // Pertahankan urutan kiri-ke-kanan membujur dari posisi mereka saat di depan VIP supaya tidak bersilangan!
  const idsUrutX = ids.slice().sort((a, b) => pointsDepanVip[a].x - pointsDepanVip[b].x)
  for (const id of idsUrutX) {
    const m = petaMember.get(id)
    if (m?.role === 'drumMajor') dmIds.push(id)
    else if (m?.section === 'guard') guardIds.push(id)
    else if (m?.section === 'brass' || m?.section === 'woodwind') brassIds.push(id)
    else perkusiIds.push(id)
  }

  const pointsDisplay: Record<string, DrillPoint> = {}
  const sebarGarisX = (daftar: string[], xKiri: number, xKanan: number, yTarget: number) => {
    const yAman = Math.max(box.minY + marginY, Math.min(box.maxY - marginY, yTarget))
    daftar.forEach((id, i) => {
      const t = daftar.length <= 1 ? 0.5 : i / (daftar.length - 1)
      const xMentah = xKiri + (xKanan - xKiri) * t
      const xAman = Math.max(box.minX + marginX, Math.min(box.maxX - marginX, xMentah))
      pointsDisplay[id] = {
        x: Math.round(xAman * 1000) / 1000,
        y: Math.round(yAman * 1000) / 1000,
        facing: hadapVip,
      }
    })
  }

  // Gitapati paling depan menghadap VIP
  if (dmIds.length > 0) {
    sebarGarisX(
      dmIds,
      xVipPusat - Math.min(2 * sYd, bentangVipYd * 0.15),
      xVipPusat + Math.min(2 * sYd, bentangVipYd * 0.15),
      arahKeVipY * setengahLebarAmanYd * 0.88,
    )
  }

  // Brass dibagi maksimal 2 saf melintang menghadap VIP (company front resonan)
  if (brassIds.length > 0) {
    const batasSafDepan = Math.ceil(brassIds.length / 2)
    const saf1 = brassIds.slice(0, batasSafDepan)
    const saf2 = brassIds.slice(batasSafDepan)
    const rentangBrass = bentangVipYd * 0.36
    sebarGarisX(saf1, xVipPusat - rentangBrass, xVipPusat + rentangBrass, arahKeVipY * setengahLebarAmanYd * 0.48)
    if (saf2.length > 0) {
      sebarGarisX(saf2, xVipPusat - rentangBrass * 0.9, xVipPusat + rentangBrass * 0.9, 0)
    }
  }

  // Guard membingkai sayap kiri & kanan panggung VIP agar visual bendera maksimal tanpa menghalangi Brass
  if (guardIds.length > 0) {
    const separuh = Math.ceil(guardIds.length / 2)
    const sayap1 = guardIds.slice(0, separuh)
    const sayap2 = guardIds.slice(separuh)
    sebarGarisX(
      sayap1,
      xVipPusat - bentangVipYd * 0.48,
      xVipPusat - bentangVipYd * 0.38,
      arahKeVipY * setengahLebarAmanYd * 0.3,
    )
    if (sayap2.length > 0) {
      sebarGarisX(
        sayap2,
        xVipPusat + bentangVipYd * 0.38,
        xVipPusat + bentangVipYd * 0.48,
        arahKeVipY * setengahLebarAmanYd * 0.3,
      )
    }
  }

  // Battery & Perkusi terpusat kokoh di belakang Brass sebagai poros tempo
  if (perkusiIds.length > 0) {
    const rentangPerkusi = Math.min(bentangVipYd * 0.28, Math.max(sYd, perkusiIds.length * sYd * 0.9))
    sebarGarisX(
      perkusiIds,
      xVipPusat - rentangPerkusi,
      xVipPusat + rentangPerkusi,
      -arahKeVipY * setengahLebarAmanYd * 0.58,
    )
  }

  // Set 3: Kembali ke susunan Banjar × Saf PERSIS seperti `pointsDepanVip`, digeser maju 6 langkah melewati panggung!
  const majuSelepasVipYd = 6 * sYd
  const pointsKembaliDefile: Record<string, DrillPoint> = {}
  for (const id of ids) {
    const pt = pointsDepanVip[id]
    const xKeluar = Math.max(box.minX + marginX, Math.min(box.maxX - marginX, pt.x + majuSelepasVipYd * arahX))
    pointsKembaliDefile[id] = {
      x: Math.round(xKeluar * 1000) / 1000,
      y: pt.y,
      facing: hadapJalan,
    }
  }

  const hitunganDisplay = Math.max(8, Math.round(opsi?.hitunganDisplay ?? 16))

  return [
    {
      nameSuffix: 'MasukVIP',
      counts: 12,
      points: pointsDepanVip,
      notes: `Barisan masuk tepat di depan ${p.labelPanggung} dalam susunan defile penuh, bersiap membuka display.`,
    },
    {
      nameSuffix: 'DisplayVIP',
      counts: hitunganDisplay,
      points: pointsDisplay,
      visual: {
        simbol: ['horn_up', 'hadap_depan'],
        catatan: `Company front menghadap ${p.labelPanggung} — proyeksi penuh ke tribun juri!`,
      },
      notes: `Display kehormatan menghadap ${p.labelPanggung}: Brass di depan, Guard membingkai sayap, Perkusi menjaga poros belakang.`,
    },
    {
      nameSuffix: 'KembaliDefile',
      counts: hitunganMajuVip,
      points: pointsKembaliDefile,
      notes: `Tutup kembali ke susunan Banjar × Saf defile semula & lanjutkan kirab meninggalkan zona panggung.`,
    },
  ]
}

/* ========================================================================== */
/*  3. Kalkulator Ketukan, Kecepatan, Pengulangan Lagu, & Cadangan Napas       */
/* ========================================================================== */

export interface InputKalkulatorParade {
  /** Panjang total rute kirab dalam meter (mis. 1500 = 1,5 km) */
  panjangRuteM: number
  /** Tempo langkah dalam ketukan per menit (mis. 116 BPM) */
  bpm: number
  /** Panjang satu langkah kirab dalam sentimeter (mis. 60 cm atau 57.15 cm untuk 8-to-5) */
  panjangLangkahCm: number
  /** Durasi satu putaran lagu / medli repertoar dalam detik (mis. 150 dtk) */
  durasiLaguDetik: number
  /** Jumlah ketukan *street beat* / *cadence* perkusi jeda napas antar-lagu (mis. 32 ketukan) */
  ketukanStreetBeat: number
  /** Tambahan waktu berhenti *display* di Panggung Kehormatan dalam menit (opsional, bawaan 0) */
  durasiDisplayVipMenit?: number
}

export interface HasilKalkulatorParade {
  panjangRuteM: number
  panjangRuteKm: number
  bpm: number
  panjangLangkahCm: number
  kecepatanMPerMenit: number
  kecepatanKmPerJam: number
  totalLangkah: number
  totalKetukanJalan: number
  waktuJalanMenit: number
  durasiDisplayVipMenit: number
  totalWaktuTempuhMenit: number
  durasiStreetBeatDetik: number
  durasiSatuSiklusDetik: number
  jarakLaguM: number
  jarakStreetBeatM: number
  jarakSatuSiklusM: number
  jumlahPengulanganLagu: number
  rasioCadanganNapasPersen: number
  statusKetahanan: 'nyaman' | 'padat' | 'rawan_kelelahan'
  rekomendasiNapas: string
}

/**
 * Hitung kecepatan rute kirab, waktu tempuh total, jumlah pengulangan lagu/*street beat*,
 * dan persentase cadangan napas seksi tiup sepanjang rute.
 */
export function hitungRuteParade(input: InputKalkulatorParade): HasilKalkulatorParade {
  const panjangRuteM = Math.max(10, Number.isFinite(input.panjangRuteM) ? input.panjangRuteM : 1500)
  const bpm = Math.max(40, Math.min(240, Number.isFinite(input.bpm) ? input.bpm : 116))
  const panjangLangkahCm = Math.max(25, Math.min(120, Number.isFinite(input.panjangLangkahCm) ? input.panjangLangkahCm : 60))
  const durasiLaguDetik = Math.max(15, Number.isFinite(input.durasiLaguDetik) ? input.durasiLaguDetik : 150)
  const ketukanStreetBeat = Math.max(0, Math.round(Number.isFinite(input.ketukanStreetBeat) ? input.ketukanStreetBeat : 32))
  const durasiDisplayVipMenit = Math.max(0, Number.isFinite(input.durasiDisplayVipMenit ?? 0) ? (input.durasiDisplayVipMenit ?? 0) : 0)

  const langkahM = panjangLangkahCm / 100
  const kecepatanMPerMenit = bpm * langkahM
  const kecepatanKmPerJam = (kecepatanMPerMenit * 60) / 1000
  const totalLangkah = Math.ceil(panjangRuteM / langkahM)
  const waktuJalanMenit = panjangRuteM / kecepatanMPerMenit
  const totalKetukanJalan = Math.ceil(waktuJalanMenit * bpm)
  const totalWaktuTempuhMenit = waktuJalanMenit + durasiDisplayVipMenit

  const durasiStreetBeatDetik = (ketukanStreetBeat / bpm) * 60
  const durasiSatuSiklusDetik = durasiLaguDetik + durasiStreetBeatDetik
  const kecepatanMPerDetik = kecepatanMPerMenit / 60
  const jarakLaguM = durasiLaguDetik * kecepatanMPerDetik
  const jarakStreetBeatM = durasiStreetBeatDetik * kecepatanMPerDetik
  const jarakSatuSiklusM = Math.max(1, jarakLaguM + jarakStreetBeatM)

  const jumlahPengulanganLagu = Math.max(1, Math.ceil(panjangRuteM / jarakSatuSiklusM))
  const rasioCadanganNapasPersen =
    durasiSatuSiklusDetik > 0 ? (durasiStreetBeatDetik / durasiSatuSiklusDetik) * 100 : 0

  let statusKetahanan: HasilKalkulatorParade['statusKetahanan'] = 'nyaman'
  let rekomendasiNapas = `Cadangan napas seimbang (${Math.round(rasioCadanganNapasPersen)}% waktu siklus berupa street beat perkusi, tiap lagu beristirahat sejauh ${Math.round(jarakStreetBeatM)} m).`

  if (panjangRuteM >= 1000 && rasioCadanganNapasPersen < 10) {
    statusKetahanan = 'rawan_kelelahan'
    const saranBeat = Math.ceil(((durasiLaguDetik * 0.22 * bpm) / 60) / 8) * 8
    rekomendasiNapas = `Rawan bibir pecah/kelelahan Brass! Jeda street beat hanya ${Math.round(rasioCadanganNapasPersen)}% untuk rute ${(panjangRuteM / 1000).toFixed(2).replace('.', ',')} km. Naikkan street beat ke minimal ${saranBeat} ketukan atau bagi giliran koral.`
  } else if (rasioCadanganNapasPersen < 18 || (panjangRuteM >= 2500 && rasioCadanganNapasPersen < 22)) {
    statusKetahanan = 'padat'
    rekomendasiNapas = `Siklus tiup cukup padat (${Math.round(rasioCadanganNapasPersen)}% jeda napas). Siapkan aba-aba roll-off perkusi atau selang-seling seksi melodi di tengah rute.`
  }

  return {
    panjangRuteM: Math.round(panjangRuteM),
    panjangRuteKm: Math.round((panjangRuteM / 1000) * 100) / 100,
    bpm: Math.round(bpm * 10) / 10,
    panjangLangkahCm: Math.round(panjangLangkahCm * 10) / 10,
    kecepatanMPerMenit: Math.round(kecepatanMPerMenit * 100) / 100,
    kecepatanKmPerJam: Math.round(kecepatanKmPerJam * 100) / 100,
    totalLangkah,
    totalKetukanJalan,
    waktuJalanMenit: Math.round(waktuJalanMenit * 10) / 10,
    durasiDisplayVipMenit: Math.round(durasiDisplayVipMenit * 10) / 10,
    totalWaktuTempuhMenit: Math.round(totalWaktuTempuhMenit * 10) / 10,
    durasiStreetBeatDetik: Math.round(durasiStreetBeatDetik * 10) / 10,
    durasiSatuSiklusDetik: Math.round(durasiSatuSiklusDetik * 10) / 10,
    jarakLaguM: Math.round(jarakLaguM * 10) / 10,
    jarakStreetBeatM: Math.round(jarakStreetBeatM * 10) / 10,
    jarakSatuSiklusM: Math.round(jarakSatuSiklusM * 10) / 10,
    jumlahPengulanganLagu,
    rasioCadanganNapasPersen: Math.round(rasioCadanganNapasPersen * 10) / 10,
    statusKetahanan,
    rekomendasiNapas,
  }
}
