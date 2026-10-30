/**
 * #15a — Kolaborasi Multi-Pelatih Seksi ("Kirim Setoran Seksi" & "Gabung Setoran Asisten").
 *
 * Modul murni di atas `pindah.ts` (tanpa ketergantungan Dexie, React, atau DOM):
 *  1. Menyusun berkas `BerkasPindah` (`format: 'drillkit-data'`) yang otomatis
 *     dibatasi ketat ke satu seksi milik asisten pelatih (absensi, evaluasi,
 *     setoran hafalan #14, catatan anggota, dan centang `kemajuan` seksi itu)
 *     tanpa pernah membocorkan kolom rahasia anggota (`token`, `phone`, `notes`).
 *  2. Menghitung ringkasan penggabungan per seksi untuk Pelatih Kepala —
 *     membuktikan secara eksplisit bahwa seksi lain di perangkat tidak tersentuh.
 *  3. Menggabungkan `kemajuan`, `setoran`, dan `absensi` secara transparan
 *     tanpa menimpa centang seksi lain maupun melanggar indeks unik `[sessionId+memberId]`.
 */
import type {
  AttendanceRecord,
  CatatanSetoran,
  Evaluasi,
  Kemajuan,
  Member,
  MemberNote,
  SectionDef,
  Session,
  TargetSetoran,
} from '../db/types'
import type { BerkasPindah, MetaSetoranSeksi } from './pindah'
import { gabungCatatanSetoran, idCatatanSetoran, skorJenjangSetoran } from './setoran'

export type RentangSetoranSeksi = MetaSetoranSeksi['rentang']

export const LABEL_RENTANG_SEKSI: Record<RentangSetoranSeksi, string> = {
  'hari-ini': 'Hari ini saja',
  '7-hari': '7 hari terakhir',
  semua: 'Semua waktu',
}

export interface SumberKolaborasiSeksi {
  anggota: Member[]
  jadwal: Session[]
  absensi: AttendanceRecord[]
  evaluasi: Evaluasi[]
  catatan: MemberNote[]
  targetSetoran: TargetSetoran[]
  setoran: CatatanSetoran[]
  kemajuan: Kemajuan[]
}

export interface PratinjauKirimSeksi {
  seksi: string
  anggota: number
  absensi: number
  evaluasi: number
  setoran: number
  catatan: number
  kemajuanDrill: number
  kemajuanCentang: number
  totalAksi: number
}

/** Konversi epoch ms ke tanggal YYYY-MM-DD (UTC, selaras `capTanggal`). */
function epochKeIso(ms: number | undefined): string | null {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return null
  return new Date(ms).toISOString().slice(0, 10)
}

/** Geser tanggal YYYY-MM-DD mundur `hari` hari secara deterministik di UTC. */
function geserHariIso(iso: string, hari: number): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!m) return iso
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]) + hari))
  return d.toISOString().slice(0, 10)
}

/** Apakah tanggal `iso` masuk ke dalam rentang terhadap `tanggalAcuan`? */
export function masukRentangSeksi(
  iso: string | null | undefined,
  rentang: RentangSetoranSeksi,
  tanggalAcuan: string,
): boolean {
  if (rentang === 'semua') return true
  if (!iso) return false
  if (rentang === 'hari-ini') return iso === tanggalAcuan
  const batasBawah = geserHariIso(tanggalAcuan, -6)
  return iso >= batasBawah && iso <= tanggalAcuan
}

/** Bersihkan kolom rahasia anggota sebelum dikirim ke/dari asisten pelatih. */
export function bersihkanAnggotaSeksi(m: Member): Member {
  const { token: _t, phone: _p, notes: _n, ...sisa } = m
  return { ...sisa, token: '' } as Member
}

/**
 * Saring seluruh sumber data hanya untuk satu `seksi` dan `rentang` waktu.
 */
function saringDataSeksi(
  sumber: SumberKolaborasiSeksi,
  seksi: string,
  rentang: RentangSetoranSeksi,
  tanggalAcuan: string,
) {
  const anggotaSeksi = sumber.anggota.filter((m) => m.section === seksi)
  const idAnggotaSeksi = new Set(anggotaSeksi.map((m) => m.id))
  const petaTanggalSesi = new Map(sumber.jadwal.map((s) => [s.id, s.date]))

  const absensi = sumber.absensi.filter((a) => {
    if (!idAnggotaSeksi.has(a.memberId)) return false
    const tgl = petaTanggalSesi.get(a.sessionId) ?? epochKeIso(a.checkInAt)
    return masukRentangSeksi(tgl, rentang, tanggalAcuan)
  })

  const evaluasi = sumber.evaluasi.filter(
    (e) => idAnggotaSeksi.has(e.memberId) && masukRentangSeksi(e.tanggal, rentang, tanggalAcuan),
  )

  const catatan = sumber.catatan.filter(
    (c) => idAnggotaSeksi.has(c.memberId) && masukRentangSeksi(epochKeIso(c.at), rentang, tanggalAcuan),
  )

  const setoran = sumber.setoran.filter((s) => {
    if (!idAnggotaSeksi.has(s.memberId)) return false
    if (s.jenjang === 'belum' && !(s.catatan && s.catatan.trim())) return false
    return masukRentangSeksi(s.tanggal || epochKeIso(s.diubahAt), rentang, tanggalAcuan)
  })

  const kemajuan: Kemajuan[] = []
  let kemajuanCentang = 0
  for (const k of sumber.kemajuan) {
    const centangSeksi: Record<string, Record<string, number>> = {}
    let adaDiDrill = false
    for (const [setId, petaKunci] of Object.entries(k.centang ?? {})) {
      const ts = petaKunci?.[seksi]
      if (typeof ts !== 'number' || ts <= 0) continue
      if (!masukRentangSeksi(epochKeIso(ts), rentang, tanggalAcuan)) continue
      centangSeksi[setId] = { [seksi]: ts }
      kemajuanCentang += 1
      adaDiDrill = true
    }
    if (adaDiDrill) {
      kemajuan.push({
        key: k.key,
        centang: centangSeksi,
        diubah: k.diubah,
      })
    }
  }

  const idSesiTerpakai = new Set(absensi.map((a) => a.sessionId).filter(Boolean))
  const jadwal = sumber.jadwal.filter((s) => idSesiTerpakai.has(s.id))

  const idTargetTerpakai = new Set(setoran.map((s) => s.targetId).filter(Boolean))
  const targetSetoran = sumber.targetSetoran.filter((t) => idTargetTerpakai.has(t.id))

  return {
    anggotaSeksi,
    jadwal,
    absensi,
    evaluasi,
    catatan,
    targetSetoran,
    setoran,
    kemajuan,
    kemajuanCentang,
  }
}

/**
 * Hitung pratinjau cepat berapa entitas seksi yang siap dikirim asisten.
 */
export function hitungPratinjauSetoranSeksi(
  sumber: SumberKolaborasiSeksi,
  seksi: string,
  rentang: RentangSetoranSeksi,
  tanggalAcuan: string,
): PratinjauKirimSeksi {
  if (!seksi) {
    return {
      seksi: '',
      anggota: 0,
      absensi: 0,
      evaluasi: 0,
      setoran: 0,
      catatan: 0,
      kemajuanDrill: 0,
      kemajuanCentang: 0,
      totalAksi: 0,
    }
  }
  const h = saringDataSeksi(sumber, seksi, rentang, tanggalAcuan)
  const totalAksi =
    h.absensi.length + h.evaluasi.length + h.setoran.length + h.catatan.length + h.kemajuanCentang
  return {
    seksi,
    anggota: h.anggotaSeksi.length,
    absensi: h.absensi.length,
    evaluasi: h.evaluasi.length,
    setoran: h.setoran.length,
    catatan: h.catatan.length,
    kemajuanDrill: h.kemajuan.length,
    kemajuanCentang: h.kemajuanCentang,
    totalAksi,
  }
}

/**
 * Susun `BerkasPindah` khusus asisten pelatih satu seksi.
 */
export function susunBerkasSetoranSeksi(
  sumber: SumberKolaborasiSeksi,
  opsi: {
    seksi: string
    labelSeksi: string
    oleh?: string
    rentang: RentangSetoranSeksi
    tanggalAcuan: string
    dibuat?: number
  },
): BerkasPindah {
  const h = saringDataSeksi(sumber, opsi.seksi, opsi.rentang, opsi.tanggalAcuan)
  const berkas: BerkasPindah = {
    format: 'drillkit-data',
    versi: 1,
    dibuat: opsi.dibuat ?? Date.now(),
    asistenSeksi: {
      seksi: opsi.seksi,
      labelSeksi: opsi.labelSeksi,
      oleh: opsi.oleh?.trim() || undefined,
      rentang: opsi.rentang,
      tanggalAcuan: opsi.tanggalAcuan,
    },
  }
  if (h.anggotaSeksi.length) berkas.anggota = h.anggotaSeksi.map(bersihkanAnggotaSeksi)
  if (h.jadwal.length) berkas.jadwal = h.jadwal.map((s) => ({ ...s }))
  if (h.absensi.length) berkas.absensi = h.absensi.map((a) => ({ ...a }))
  if (h.evaluasi.length) berkas.evaluasi = h.evaluasi.map((e) => ({ ...e }))
  if (h.catatan.length) berkas.catatan = h.catatan.map((c) => ({ ...c }))
  if (h.targetSetoran.length) berkas.targetSetoran = h.targetSetoran.map((t) => ({ ...t }))
  if (h.setoran.length) berkas.setoran = h.setoran.map((s) => ({ ...s }))
  if (h.kemajuan.length) berkas.kemajuan = h.kemajuan
  return berkas
}

/* --------------------- Penggabungan Aman di Pelatih Kepala ---------------- */

export interface BentrokAbsensiAsisten {
  sessionId: string
  judulSesi: string
  memberId: string
  namaAnggota: string
  seksi: string
  statusLokal: AttendanceRecord['status']
  statusMasuk: AttendanceRecord['status']
}

export interface BarisRingkasSeksi {
  seksi: string
  label: string
  absensiBaru: number
  absensiBentrok: number
  evaluasi: number
  setoran: number
  catatan: number
  kemajuanCentang: number
}

export interface RingkasanGabungSeksi {
  perSeksi: BarisRingkasSeksi[]
  seksiTakTersentuh: { seksi: string; label: string }[]
  bentrokAbsensi: BentrokAbsensiAsisten[]
}

/**
 * Hitung ringkasan per seksi sebelum Pelatih Kepala menekan "Terapkan".
 * Menunjukkan seksi mana yang datanya masuk, bentrokan absensi apa saja yang ada,
 * dan seksi mana saja di perangkat lokal yang 100% aman tidak tersentuh.
 */
export function ringkasGabungSeksi(
  berkas: BerkasPindah,
  lokal: Pick<SumberKolaborasiSeksi, 'anggota' | 'jadwal' | 'absensi'>,
  daftarSeksiTim?: SectionDef[],
): RingkasanGabungSeksi {
  const petaLabel = new Map<string, string>()
  for (const s of daftarSeksiTim ?? []) petaLabel.set(s.id, s.label)
  const labelUntuk = (id: string) => petaLabel.get(id) ?? (id === '*' ? 'Seluruh tim' : id || 'Lainnya')

  const petaAnggota = new Map<string, { name: string; section: string }>()
  for (const m of lokal.anggota) petaAnggota.set(m.id, { name: m.name, section: m.section })
  for (const m of berkas.anggota ?? []) {
    if (!petaAnggota.has(m.id)) petaAnggota.set(m.id, { name: m.name, section: m.section })
  }

  const petaSesi = new Map<string, string>()
  for (const s of lokal.jadwal) petaSesi.set(s.id, s.title || s.date)
  for (const s of berkas.jadwal ?? []) {
    if (!petaSesi.has(s.id)) petaSesi.set(s.id, s.title || s.date)
  }

  const absensiLokalPerPasang = new Map<string, AttendanceRecord>()
  for (const a of lokal.absensi) absensiLokalPerPasang.set(`${a.sessionId}|${a.memberId}`, a)

  const ember = new Map<string, BarisRingkasSeksi>()
  const ambilEmber = (seksi: string): BarisRingkasSeksi => {
    const kunci = seksi || (berkas.asistenSeksi?.seksi ?? 'lainnya')
    let b = ember.get(kunci)
    if (!b) {
      b = {
        seksi: kunci,
        label:
          kunci === berkas.asistenSeksi?.seksi && berkas.asistenSeksi.labelSeksi
            ? berkas.asistenSeksi.labelSeksi
            : labelUntuk(kunci),
        absensiBaru: 0,
        absensiBentrok: 0,
        evaluasi: 0,
        setoran: 0,
        catatan: 0,
        kemajuanCentang: 0,
      }
      ember.set(kunci, b)
    }
    return b
  }

  const bentrokAbsensi: BentrokAbsensiAsisten[] = []

  for (const a of berkas.absensi ?? []) {
    const info = petaAnggota.get(a.memberId)
    const b = ambilEmber(info?.section ?? '')
    const ada = absensiLokalPerPasang.get(`${a.sessionId}|${a.memberId}`)
    if (!ada) {
      b.absensiBaru += 1
    } else if (ada.status !== a.status) {
      b.absensiBentrok += 1
      bentrokAbsensi.push({
        sessionId: a.sessionId,
        judulSesi: petaSesi.get(a.sessionId) ?? a.sessionId,
        memberId: a.memberId,
        namaAnggota: info?.name ?? a.memberId,
        seksi: b.label,
        statusLokal: ada.status,
        statusMasuk: a.status,
      })
    }
  }

  for (const e of berkas.evaluasi ?? []) {
    const info = petaAnggota.get(e.memberId)
    ambilEmber(info?.section ?? '').evaluasi += 1
  }

  for (const s of berkas.setoran ?? []) {
    const info = petaAnggota.get(s.memberId)
    ambilEmber(info?.section ?? '').setoran += 1
  }

  for (const c of berkas.catatan ?? []) {
    const info = petaAnggota.get(c.memberId)
    ambilEmber(info?.section ?? '').catatan += 1
  }

  for (const k of berkas.kemajuan ?? []) {
    for (const petaKunci of Object.values(k.centang ?? {})) {
      for (const [kunciSeksi, ts] of Object.entries(petaKunci ?? {})) {
        if (typeof ts === 'number' && ts > 0) {
          ambilEmber(kunciSeksi).kemajuanCentang += 1
        }
      }
    }
  }

  const semuaSeksiLokal = new Set<string>()
  for (const m of lokal.anggota) if (m.section) semuaSeksiLokal.add(m.section)
  for (const s of daftarSeksiTim ?? []) if (s.id) semuaSeksiLokal.add(s.id)

  const seksiTakTersentuh: { seksi: string; label: string }[] = []
  for (const idSeksi of semuaSeksiLokal) {
    if (!ember.has(idSeksi)) {
      seksiTakTersentuh.push({ seksi: idSeksi, label: labelUntuk(idSeksi) })
    }
  }

  return {
    perSeksi: [...ember.values()],
    seksiTakTersentuh,
    bentrokAbsensi,
  }
}

/**
 * Gabungkan `kemajuan` per set × seksi secara mendalam — TIDAK PERNAH menghapus
 * centang seksi lain maupun centang seluruh tim (`'*'`) yang sudah ada di perangkat!
 */
export function gabungKemajuanAman(
  masuk: Kemajuan[],
  lokal: Kemajuan[],
): { tulis: Kemajuan[]; centangBaru: number; centangDiperbarui: number } {
  const petaLokal = new Map(lokal.map((k) => [k.key, k]))
  const tulis: Kemajuan[] = []
  let centangBaru = 0
  let centangDiperbarui = 0

  for (const m of masuk) {
    if (!m.key) continue
    const ada = petaLokal.get(m.key)
    if (!ada) {
      for (const p of Object.values(m.centang ?? {})) {
        centangBaru += Object.values(p ?? {}).filter((v) => typeof v === 'number' && v > 0).length
      }
      tulis.push({
        key: m.key,
        centang: JSON.parse(JSON.stringify(m.centang ?? {})),
        diubah: m.diubah || Date.now(),
      })
      continue
    }

    const gabunganCentang: Record<string, Record<string, number>> = {}
    for (const [setId, petaKunci] of Object.entries(ada.centang ?? {})) {
      gabunganCentang[setId] = { ...petaKunci }
    }
    for (const [setId, petaKunci] of Object.entries(m.centang ?? {})) {
      const targetSet = gabunganCentang[setId] ? { ...gabunganCentang[setId] } : {}
      for (const [kunciSeksi, tsMasuk] of Object.entries(petaKunci ?? {})) {
        if (typeof tsMasuk !== 'number' || tsMasuk <= 0) continue
        const tsLokal = targetSet[kunciSeksi] ?? 0
        if (tsLokal === 0) centangBaru += 1
        else if (tsMasuk > tsLokal) centangDiperbarui += 1
        targetSet[kunciSeksi] = Math.max(tsLokal, tsMasuk)
      }
      gabunganCentang[setId] = targetSet
    }
    tulis.push({
      key: m.key,
      centang: gabunganCentang,
      diubah: Math.max(ada.diubah || 0, m.diubah || 0),
    })
  }

  return { tulis, centangBaru, centangDiperbarui }
}

/**
 * Gabungkan `setoran` hafalan dari asisten dengan yang sudah ada di perangkat.
 * Mempertahankan jenjang tertinggi (`gabungCatatanSetoran`) dan melaporkan bila
 * ada perbedaan yang disatukan secara otomatis.
 */
export function gabungSetoranAman(
  masuk: CatatanSetoran[],
  lokal: CatatanSetoran[],
): { tulis: CatatanSetoran[]; laporan: string[] } {
  const petaLokal = new Map<string, CatatanSetoran>()
  for (const s of lokal) {
    petaLokal.set(idCatatanSetoran(s.targetId, s.memberId), s)
  }
  const tulis: CatatanSetoran[] = []
  const laporan: string[] = []

  for (const m of masuk) {
    if (!m.targetId || !m.memberId) continue
    const kunci = idCatatanSetoran(m.targetId, m.memberId)
    const normalMasuk: CatatanSetoran = m.id === kunci ? m : { ...m, id: kunci }
    const ada = petaLokal.get(kunci)
    if (!ada) {
      tulis.push(normalMasuk)
      petaLokal.set(kunci, normalMasuk)
      continue
    }
    const hasil = gabungCatatanSetoran(ada, normalMasuk)
    if (skorJenjangSetoran(ada.jenjang) > skorJenjangSetoran(normalMasuk.jenjang)) {
      laporan.push(
        `Setoran ${m.memberId} (${m.targetId}): jenjang lokal lebih tinggi (${ada.jenjang} vs ${normalMasuk.jenjang}), dipertahankan.`,
      )
    }
    tulis.push(hasil)
    petaLokal.set(kunci, hasil)
  }

  return { tulis, laporan }
}

/**
 * Gabungkan `absensi` asisten pelatih tanpa menabrak indeks unik `[sessionId+memberId]`.
 *
 * - Bila pasangan `(sessionId, memberId)` belum ada di perangkat → ditambahkan utuh.
 * - Bila sudah ada dan statusnya sama → pertahankan `id` lokal (gabungkan catatan bila kosong).
 * - Bila sudah ada dan statusnya berbeda:
 *   - `utamakanAsisten === true` → perbarui `status`/`checkInAt`/`note` menggunakan `id` lokal.
 *   - `utamakanAsisten === false` → pertahankan status lokal dan laporkan.
 */
export function gabungAbsensiAsisten(
  masuk: AttendanceRecord[],
  lokal: AttendanceRecord[],
  utamakanAsisten: boolean,
): { tulis: AttendanceRecord[]; laporan: string[] } {
  const petaLokal = new Map<string, AttendanceRecord>()
  for (const a of lokal) petaLokal.set(`${a.sessionId}|${a.memberId}`, a)

  const tulis: AttendanceRecord[] = []
  const laporan: string[] = []

  for (const m of masuk) {
    if (!m.sessionId || !m.memberId) continue
    const kunci = `${m.sessionId}|${m.memberId}`
    const ada = petaLokal.get(kunci)
    if (!ada) {
      tulis.push(m)
      petaLokal.set(kunci, m)
      continue
    }
    if (ada.status === m.status) {
      const catatanGabung = ada.note?.trim() ? ada.note : m.note
      if (catatanGabung !== ada.note) {
        const diperbarui = { ...ada, note: catatanGabung }
        tulis.push(diperbarui)
        petaLokal.set(kunci, diperbarui)
      }
      continue
    }
    if (utamakanAsisten) {
      const diperbarui: AttendanceRecord = {
        ...ada,
        status: m.status,
        checkInAt: m.checkInAt ?? ada.checkInAt,
        note: m.note?.trim() ? m.note : ada.note,
      }
      tulis.push(diperbarui)
      petaLokal.set(kunci, diperbarui)
      laporan.push(
        `Absensi sesi ${m.sessionId} (${m.memberId}): diperbarui ${ada.status} → ${m.status} dari asisten.`,
      )
    } else {
      laporan.push(
        `Absensi sesi ${m.sessionId} (${m.memberId}): tetap ${ada.status} (catatan asisten: ${m.status}).`,
      )
    }
  }

  return { tulis, laporan }
}
