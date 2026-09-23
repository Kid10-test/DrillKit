/* ========================================================================== */
/*  DD7 — Tukar formasi lewat CSV                                             */
/*                                                                            */
/*  Modul ini sengaja **murni** (tidak menyentuh DOM, DB, atau React) supaya   */
/*  bisa diuji langsung di node. Yang dipakai UI:                              */
/*                                                                            */
/*    uraiCsv(teks)            → baris-baris CSV                               */
/*    sarankanPemetaan(baris)  → tebakan kolom kode/nama & pasangan X/Y        */
/*    imporBaris(...)          → posisi per pemain per set, sudah dalam yard   */
/*                                                                            */
/*  Dua bentuk berkas didukung:                                                */
/*                                                                            */
/*   LEBAR — satu baris per pemain, sepasang kolom X/Y tiap set:               */
/*     Kode,Nama,Set 1 X,Set 1 Y,Set 2 X,Set 2 Y                               */
/*     C01,Andra,-8,12,-4,10                                                   */
/*                                                                            */
/*   PANJANG — satu baris per pemain per set (bentuk lembar koordinat):        */
/*     Set,Kode,Nama,X (steps),Y (steps)                                       */
/*     Set 1 — Blok,C01,Andra,-8,12                                            */
/*                                                                            */
/*  Yang LEBAR dipakai untuk bertukar dengan Excel/Pyware karena enak diedit;  */
/*  yang PANJANG diterima supaya berkas hasil ekspor sendiri bisa masuk lagi. */
/* ========================================================================== */

/** Satuan angka pada berkas CSV. */
export type SatuanCsv = 'langkah' | 'yard' | 'meter'

/** Dari mana nilai Y pada berkas CSV diukur. */
export type AsalYCsv = 'belakang' | 'tengah'

/** Sepasang kolom X/Y untuk satu set (bentuk lebar). */
export interface KolomSet {
  /** urutan set, mulai 0 */
  setKe: number
  /** indeks kolom X, -1 bila tidak ada */
  x: number
  /** indeks kolom Y, -1 bila tidak ada */
  y: number
}

export interface Pemetaan {
  /** indeks kolom kode pemain, -1 bila tidak ada */
  kode: number
  /** indeks kolom nama pemain, -1 bila tidak ada */
  nama: number
  /** bentuk lebar: sepasang kolom tiap set */
  lebar: KolomSet[]
  /** bentuk panjang: kolom nama set + X + Y */
  panjang: { set: number; x: number; y: number } | null
}

/** Satu baris hasil impor, sebelum dicocokkan dengan anggota. */
export interface BarisImpor {
  kode: string
  nama: string
  /** posisi per set (yard, sistem koordinat aplikasi); null bila tidak ada */
  pos: ({ x: number; y: number } | null)[]
}

export interface OpsiImpor {
  /** yard per langkah (dari pengaturan lapangan) */
  sYd: number
  /** lebar lapangan (yard) — dipakai mengubah asal Y */
  lebarYd: number
  satuan: SatuanCsv
  asalY: AsalYCsv
}

export interface HasilImpor {
  pemetaan: Pemetaan
  adaHeader: boolean
  /** nama set hasil impor, dalam urutan kolom */
  namaSet: string[]
  baris: BarisImpor[]
  /** jumlah baris yang dilewati karena selnya tidak terbaca */
  dilewati: number
  /** bentuk berkas yang terdeteksi */
  bentuk: 'lebar' | 'panjang' | 'tidak-dikenal'
}

/* ------------------------------- Pengurai --------------------------------- */

/** Tebak pemisah kolom: koma, titik koma, atau tab. */
export function deteksiDelimiter(teks: string): ',' | ';' | '\t' {
  const baris = teks.split(/\r?\n/).find((b) => b.trim() !== '') ?? ''
  const hitung = { ',': 0, ';': 0, '\t': 0 } as Record<',' | ';' | '\t', number>
  let dalamKutip = false
  for (const ch of baris) {
    if (ch === '"') dalamKutip = !dalamKutip
    else if (!dalamKutip && (ch === ',' || ch === ';' || ch === '\t')) hitung[ch]++
  }
  const urut: (',' | ';' | '\t')[] = [',', ';', '\t']
  return urut.reduce((a, b) => (hitung[b] > hitung[a] ? b : a), ',')
}

/** Pecah satu baris CSV dengan memperhitungkan tanda kutip. */
export function pecahBaris(baris: string, pemisah: string): string[] {
  const out: string[] = []
  let cur = ''
  let dalamKutip = false
  for (let i = 0; i < baris.length; i++) {
    const ch = baris[i]
    if (dalamKutip) {
      if (ch === '"') {
        if (baris[i + 1] === '"') {
          cur += '"'
          i++
        } else dalamKutip = false
      } else cur += ch
    } else if (ch === '"') dalamKutip = true
    else if (ch === pemisah) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  out.push(cur)
  return out.map((s) => s.trim())
}

/** Urai seluruh teks CSV menjadi baris-baris sel. */
export function uraiCsv(teks: string, pemisah?: string): string[][] {
  const d = pemisah ?? deteksiDelimiter(teks)
  return teks
    .replace(/^﻿/, '')
    .split(/\r?\n/)
    .filter((b) => b.trim() !== '')
    .map((b) => pecahBaris(b, d))
}

/* ------------------------------ Tebakan ---------------------------------- */

const angkaDalam = (s: string): number | null => {
  const m = s.match(/(\d+)/)
  return m ? Number(m[1]) : null
}

/** Apakah judul kolom ini kolom X? */
const adalahX = (h: string): boolean =>
  /(^|[^a-z])x([^a-z]|$)/i.test(h) || /^x/i.test(h.trim())

/** Apakah judul kolom ini kolom Y? */
const adalahY = (h: string): boolean =>
  /(^|[^a-z])y([^a-z]|$)/i.test(h) || /^y/i.test(h.trim())

/** Apakah judul kolom ini kolom nama set (bentuk panjang)? */
const adalahSet = (h: string): boolean =>
  /(^|[^a-z])(set|formasi|formation)([^a-z]|$)/i.test(h)

/** Apakah baris ini judul kolom, bukan data? */
function tampakHeader(sel: string[]): boolean {
  if (!sel.length) return false
  const angka = sel.filter((s) => s !== '' && Number.isFinite(Number(s.replace(',', '.')))).length
  // Kalau separuh atau lebih selnya berupa angka, ini baris data.
  if (angka >= Math.ceil(sel.length / 2)) return false
  return sel.some((s) => adalahX(s) || adalahY(s) || adalahSet(s) || /kode|nama|code|name/i.test(s))
}

/**
 * Tebak pemetaan kolom dari baris-baris CSV.
 *
 * Sengaja dibiarkan sederhana: yang ditebak cuma kolom kode/nama dan pasangan
 * X/Y. Kalau tebakannya meleset, UI tetap menampilkan ringkasannya supaya
 * pengguna bisa memeriksa sebelum dipakai.
 */
export function sarankanPemetaan(baris: string[][]): { pemetaan: Pemetaan; adaHeader: boolean } {
  const kosong: Pemetaan = { kode: -1, nama: -1, lebar: [], panjang: null }
  if (!baris.length) return { pemetaan: kosong, adaHeader: false }
  const adaHeader = tampakHeader(baris[0])
  const judul = adaHeader ? baris[0] : baris[0].map((_, i) => `kolom ${i + 1}`)

  let kode = -1
  let nama = -1
  judul.forEach((h, i) => {
    if (kode < 0 && /^kode$|^code$|^no\.?$|^id$/i.test(h.trim())) kode = i
    else if (nama < 0 && /nama|name/i.test(h)) nama = i
  })
  if (kode < 0 && nama < 0) {
    // Tanpa judul yang dikenali: anggap kolom pertama kode, kedua nama.
    kode = 0
    nama = judul.length > 1 ? 1 : -1
  }

  /** Kolom X/Y yang belum terpakai, lengkap dengan nomor setnya. */
  const kandidat: { i: number; sumbu: 'x' | 'y'; setKe: number }[] = []
  let kolomSet = -1
  judul.forEach((h, i) => {
    if (i === kode || i === nama) return
    if (adalahSet(h) && !adalahX(h) && !adalahY(h)) {
      if (kolomSet < 0) kolomSet = i
      return
    }
    const n = angkaDalam(h)
    const setKe = n !== null ? n - 1 : 0
    if (adalahX(h)) kandidat.push({ i, sumbu: 'x', setKe })
    else if (adalahY(h)) kandidat.push({ i, sumbu: 'y', setKe })
  })

  if (kolomSet >= 0 && kandidat.length === 2) {
    const x = kandidat.find((k) => k.sumbu === 'x')
    const y = kandidat.find((k) => k.sumbu === 'y')
    if (x && y) return { pemetaan: { kode, nama, lebar: [], panjang: { set: kolomSet, x: x.i, y: y.i } }, adaHeader }
  }

  /**
   * Bentuk lebar: pasangkan X dan Y **berdasarkan urutan kolom**, bukan angka
   * di judulnya.
   *
   * Kenapa: nama set tidak selalu berangka. Header `Formasi A X` / `Formasi B X`
   * tidak punya angka sama sekali, jadi kalau nomor set diambil dari angka di
   * judul, semua pasangan dikira set nomor 0 — dan `Set A` & `Set B` menyusut
   * jadi satu set (bug yang ketemu saat diuji).
   *
   * Nomor di judul tetap dipakai kalau **semua** kolom X berangka; selain itu
   * urutan kemunculan yang dipakai.
   */
  const xs = kandidat.filter((k) => k.sumbu === 'x')
  const ys = kandidat.filter((k) => k.sumbu === 'y')
  const nomorX = xs.map((k) => angkaDalam(judul[k.i] ?? ''))
  const semuaBerangka = nomorX.length > 0 && nomorX.every((v) => v !== null)
  const lebar: KolomSet[] = []
  const bnyk = Math.min(xs.length, ys.length)
  for (let k = 0; k < bnyk; k++) {
    const setKe = semuaBerangka ? Math.max(0, (nomorX[k] as number) - 1) : k
    lebar.push({ setKe, x: xs[k].i, y: ys[k].i })
  }
  if (!semuaBerangka) lebar.sort((a, b) => a.x - b.x)

  /**
   * Berkas **tanpa judul kolom** tidak punya petunjuk mana X dan mana Y, jadi
   * dipakai aturan posisi: kolom 1 = kode, kolom 2 = nama, lalu berpasangan
   * (X, Y) mulai kolom 3. Kalau sisanya ganjil, berarti tidak ada kolom nama
   * dan pasangan dimulai dari kolom 2.
   */
  if (!adaHeader && !lebar.length) {
    const jml = judul.length
    const mulai = jml >= 4 && (jml - 2) % 2 === 0 ? 2 : 1
    const pasang: KolomSet[] = []
    for (let i = mulai; i + 1 < jml; i += 2) {
      pasang.push({ setKe: pasang.length, x: i, y: i + 1 })
    }
    return {
      pemetaan: { kode: 0, nama: mulai === 2 ? 1 : -1, lebar: pasang, panjang: null },
      adaHeader,
    }
  }

  return { pemetaan: { kode, nama, lebar, panjang: null }, adaHeader }
}

/* ------------------------------ Konversi --------------------------------- */

/** Ubah angka teks CSV (boleh memakai koma desimal) menjadi number. */
function angka(s: string | undefined): number | null {
  if (s === undefined) return null
  const t = s.trim().replace(',', '.')
  if (t === '') return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

/** Pengali dari satuan berkas ke yard. */
function faktorSatuan(satuan: SatuanCsv, sYd: number): number {
  if (satuan === 'yard') return 1
  if (satuan === 'meter') return 1.09361
  return sYd
}

/**
 * Urai baris-baris CSV menjadi posisi per pemain per set.
 *
 * Hasilnya sudah dalam **yard** memakai sistem koordinat aplikasi: X dari
 * tengah lapangan (positif = S1), Y dari tengah (positif = belakang). Jadi
 * nilai Y pada berkas yang diukur dari garis belakang otomatis digeser.
 */
export function imporBaris(
  baris: string[][],
  pemetaan: Pemetaan,
  opsi: OpsiImpor,
  adaHeader: boolean,
): { baris: BarisImpor[]; namaSet: string[]; dilewati: number; bentuk: HasilImpor['bentuk'] } {
  const data = adaHeader ? baris.slice(1) : baris
  const k = faktorSatuan(opsi.satuan, opsi.sYd)
  const geserY = opsi.asalY === 'belakang' ? opsi.lebarYd / 2 : 0

  const keYard = (v: number, sumbu: 'x' | 'y'): number =>
    sumbu === 'x' ? v * k : v * k - geserY

  const bentuk: HasilImpor['bentuk'] = pemetaan.panjang ? 'panjang' : pemetaan.lebar.length ? 'lebar' : 'tidak-dikenal'
  if (bentuk === 'tidak-dikenal') return { baris: [], namaSet: [], dilewati: data.length, bentuk }

  const keluar = new Map<string, BarisImpor>()
  const urutan: string[] = []
  const namaSet: string[] = []
  const urutSet = new Map<string, number>()
  let dilewati = 0

  const ambil = (sel: string[], idx: number): string | undefined =>
    idx >= 0 && idx < sel.length ? sel[idx] : undefined

  const init = (kunci: string, kode: string, nama: string): BarisImpor => {
    let b = keluar.get(kunci)
    if (!b) {
      b = { kode, nama, pos: [] }
      keluar.set(kunci, b)
      urutan.push(kunci)
    }
    return b
  }

  if (pemetaan.panjang) {
    const { set: cSet, x: cX, y: cY } = pemetaan.panjang
    for (const sel of data) {
      const namaSetCsv = (ambil(sel, cSet) ?? '').trim() || `Set ${namaSet.length + 1}`
      if (!urutSet.has(namaSetCsv)) {
        urutSet.set(namaSetCsv, namaSet.length)
        namaSet.push(namaSetCsv)
      }
      const idxSet = urutSet.get(namaSetCsv)!
      const kode = (ambil(sel, pemetaan.kode) ?? '').trim()
      const nama = (ambil(sel, pemetaan.nama) ?? '').trim()
      const vx = angka(ambil(sel, cX))
      const vy = angka(ambil(sel, cY))
      if (vx === null && vy === null) {
        dilewati++
        continue
      }
      if (!kode && !nama) {
        dilewati++
        continue
      }
      const b = init(kode || nama, kode, nama)
      while (b.pos.length <= idxSet) b.pos.push(null)
      b.pos[idxSet] =
        vx === null || vy === null ? null : { x: keYard(vx, 'x'), y: keYard(vy, 'y') }
    }
  } else {
    // Nama set diambil dari judul kolomnya ("Set A X" -> "Set A"). Lebih
    // bermakna daripada "Set 1/2/3" saat hasilnya dibaca pelatih.
    const namaDariJudul = new Map<number, string>()
    if (adaHeader) {
      for (const kx of pemetaan.lebar) {
        const judulKolom = (baris[0]?.[kx.x] ?? '').replace(/\s*[xy]\s*$/i, '').trim()
        if (judulKolom && !namaDariJudul.has(kx.setKe)) namaDariJudul.set(kx.setKe, judulKolom)
      }
    }
    for (const kx of pemetaan.lebar) {
      while (namaSet.length <= kx.setKe) {
        namaSet.push(namaDariJudul.get(namaSet.length) ?? `Set ${namaSet.length + 1}`)
      }
    }
    for (const sel of data) {
      const kode = (ambil(sel, pemetaan.kode) ?? '').trim()
      const nama = (ambil(sel, pemetaan.nama) ?? '').trim()
      if (!kode && !nama) {
        dilewati++
        continue
      }
      let kena = 0
      const b = init(kode || nama, kode, nama)
      for (const kx of pemetaan.lebar) {
        while (b.pos.length <= kx.setKe) b.pos.push(null)
        const vx = angka(ambil(sel, kx.x))
        const vy = angka(ambil(sel, kx.y))
        if (vx === null && vy === null) continue
        b.pos[kx.setKe] =
          vx === null || vy === null ? null : { x: keYard(vx, 'x'), y: keYard(vy, 'y') }
        kena++
      }
      if (!kena) dilewati++
    }
  }

  // Rapikan: tiap pemain punya slot untuk semua set, yang kosong jadi `null`
  // supaya pemanggil tidak perlu menangani `undefined`.
  const jadi = urutan.map((k2) => {
    const b = keluar.get(k2)!
    while (b.pos.length < namaSet.length) b.pos.push(null)
    return b
  })
  return { baris: jadi, namaSet, dilewati, bentuk }
}

/** Jalankan semua tahap sekaligus — dipakai UI. */
export function bacaCsvKoordinat(teks: string, opsi: OpsiImpor, pemisah?: string): HasilImpor {
  const baris = uraiCsv(teks, pemisah)
  const { pemetaan, adaHeader } = sarankanPemetaan(baris)
  const hasil = imporBaris(baris, pemetaan, opsi, adaHeader)
  return { pemetaan, adaHeader, ...hasil }
}
