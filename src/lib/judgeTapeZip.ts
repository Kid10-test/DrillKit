import { bukaZip } from './zip'

export interface JudgeTapePulih {
  penilaianId: string
  namaFile: string
  tipe: string
  ukuran: number
  durasiDetik: number
  hash: string
  blob: Blob
}

/**
 * Ekstrak berkas biner rekaman suara *Judge Tape* (`judgetape/`) dari arsip Backup ZIP (#20).
 * Murni tanpa ketergantungan Dexie maupun DOM sehingga aman diuji di Node.
 */
export function ekstrakJudgeTapeZip(bita: Uint8Array): JudgeTapePulih[] {
  const hasil: JudgeTapePulih[] = []
  let entri: { nama: string; bita: Uint8Array; teks: () => string }[]
  try {
    entri = bukaZip(bita)
  } catch {
    return hasil
  }

  let manifest: Record<
    string,
    { penilaianId: string; namaFile: string; tipe?: string; ukuran?: number; durasiDetik?: number; hash?: string }
  > = {}
  const entriManifest = entri.find((z) => z.nama === 'judgetape/manifest.json')
  if (entriManifest) {
    try {
      manifest = JSON.parse(entriManifest.teks())
    } catch {
      // abaikan — fallback ke pembacaan awalan nama berkas di bawah
    }
  }

  for (const z of entri) {
    if (!z.nama.startsWith('judgetape/') || z.nama.endsWith('.json')) continue
    const m = manifest[z.nama]
    let penilaianId = m?.penilaianId
    let namaFile = m?.namaFile
    if (!penilaianId) {
      const dasar = z.nama.replace(/^judgetape\//, '')
      const garis = dasar.indexOf('_')
      if (garis > 0) {
        penilaianId = dasar.substring(0, garis)
        namaFile = dasar.substring(garis + 1)
      }
    }
    if (penilaianId && namaFile) {
      const tipe = m?.tipe || (namaFile.endsWith('.webm') ? 'audio/webm' : 'audio/mpeg')
      hasil.push({
        penilaianId,
        namaFile,
        tipe,
        ukuran: m?.ukuran ?? z.bita.byteLength,
        durasiDetik: m?.durasiDetik ?? 0,
        hash: m?.hash ?? '',
        blob: new Blob([new Uint8Array(z.bita)], { type: tipe }),
      })
    }
  }
  return hasil
}
