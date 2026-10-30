/**
 * #7 / #12a — Pembentuk nama berkas unduhan yang jelas dan seragam.
 *
 * Sengaja dipisahkan menjadi modul murni tanpa ketergantungan ke pengurai
 * berkas berat (`zip`, `pyware`, `partitur`, `mxl`), supaya modul ringan
 * yang aktif sejak halaman pertama (seperti `simpanOtomatis` dan `backup`)
 * tidak ikut menarik seluruh mesin pendeteksi berkas ke bundel JS awal.
 */

/** Cap tanggal `2026-10-05` (UTC, sama seperti semua penanda sebelumnya). */
export function capTanggal(d = new Date()): string {
  return d.toISOString().slice(0, 10)
}

/**
 * Bersihkan teks untuk nama berkas: buang karakter terlarang
 * (`/ \ : * ? " < > |`), rapikan spasi, batasi panjangnya.
 */
export function bersihNama(s: string, batas = 60): string {
  return s
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, batas)
    .replace(/[. ]+$/, '')
}

/** Buang aksara beraksen & tanda pisah Unicode supaya aman di semua sistem berkas. */
function tanpaAksen(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\u2010-\u2015]/g, '-')
}

export function namaBackup(t?: Date): string {
  return `DrillKit - BACKUP LENGKAP - ${capTanggal(t)}.json`
}

export function namaBackupZip(t?: Date): string {
  return `DrillKit - BACKUP LENGKAP + REKAMAN - ${capTanggal(t)}.zip`
}

export function namaData(t?: Date): string {
  return `DrillKit - DATA PILIHAN - ${capTanggal(t)}.json`
}

/** #15a — `DrillKit - SETORAN SEKSI Brass (Kak Raka) - 2026-10-30.json`. */
export function namaSetoranSeksi(labelSeksi: string, oleh?: string, t?: Date): string {
  const s = bersihNama(tanpaAksen(labelSeksi), 30) || 'seksi'
  const o = oleh && oleh.trim() ? ` (${bersihNama(tanpaAksen(oleh.trim()), 24)})` : ''
  return `DrillKit - SETORAN SEKSI ${s}${o} - ${capTanggal(t)}.json`
}

export function namaShow(namaDrill: string, t?: Date): string {
  const nama = bersihNama(tanpaAksen(namaDrill), 50) || 'show'
  return `DrillKit - SHOW ${nama} - ${capTanggal(t)}.json`
}

export function namaRepertoar(jumlahLagu: number, t?: Date): string {
  return `DrillKit - LAGU (${jumlahLagu} lagu) - ${capTanggal(t)}.json`
}

export function namaPaketGrup(t?: Date): string {
  void t
  return 'DrillKit - UNTUK ANGGOTA - semua (grup).json'
}

/** `DrillKit - UNTUK ANGGOTA - Andra Pratama (Dede) A07.json`. */
export function namaPaketAnggota(nama: string, panggilan: string | undefined, kode: string): string {
  const n = bersihNama(tanpaAksen(nama), 40) || 'anggota'
  const p = panggilan && panggilan.trim() ? ` (${bersihNama(tanpaAksen(panggilan.trim()), 20)})` : ''
  const k = bersihNama(tanpaAksen(kode), 12)
  const ekor = k ? ` ${k}` : ''
  return `DrillKit - UNTUK ANGGOTA - ${n}${p}${ekor}.json`
}

/** ZIP kumpulan paket per anggota (isinya berkas-berkas `namaPaketAnggota`). */
export function namaZipAnggota(namaTim: string, t?: Date): string {
  const tim = bersihNama(tanpaAksen(namaTim), 40) || 'tim'
  return `DrillKit - UNTUK ANGGOTA - ${tim} - ${capTanggal(t)}.json`.replace(/\.json$/, '.zip')
}
