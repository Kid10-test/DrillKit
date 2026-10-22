/** #11a — ekstraksi murni berkas partitur biner dari ZIP backup. */
import { bukaZip } from './zip'

export interface PartiturPulih {
  songId: string
  namaFile: string
  tipe: 'musicxml' | 'pdf'
  blob: Blob
  ukuran: number
  hash: string
}

/** Ekstrak berkas MusicXML/PDF dari ZIP backup (#11a). */
export function ekstrakPartiturZip(bita: Uint8Array): PartiturPulih[] {
  const hasil: PartiturPulih[] = []
  let entri: { nama: string; bita: Uint8Array; teks: () => string }[]
  try {
    entri = bukaZip(bita)
  } catch {
    return hasil
  }
  let manifest: Record<
    string,
    { songId: string; namaFile: string; tipe: 'musicxml' | 'pdf'; ukuran?: number; hash?: string }
  > = {}
  const entriManifest = entri.find((z) => z.nama === 'partitur/manifest.json')
  if (entriManifest) {
    try {
      const parsed: unknown = JSON.parse(entriManifest.teks())
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        manifest = parsed as typeof manifest
      }
    } catch {
      // Abaikan manifest rusak; coba nama berkas untuk ZIP buatan tangan.
    }
  }
  for (const z of entri) {
    if (!z.nama.startsWith('partitur/') || z.nama.endsWith('.json')) continue
    const m = manifest[z.nama]
    let songId = typeof m?.songId === 'string' ? m.songId : undefined
    let namaFile = typeof m?.namaFile === 'string' ? m.namaFile : undefined
    if (!songId || !namaFile) {
      const dasar = z.nama.replace(/^partitur\//, '')
      const garis = dasar.indexOf('_')
      if (garis > 0) {
        songId ??= dasar.substring(0, garis)
        namaFile ??= dasar.substring(garis + 1)
      }
    }
    if (!songId || !namaFile) continue
    const tipe = m?.tipe === 'pdf' || m?.tipe === 'musicxml'
      ? m.tipe
      : /\.pdf$/i.test(namaFile) ? 'pdf' : 'musicxml'
    const mime = tipe === 'pdf' ? 'application/pdf' : 'application/vnd.recordare.musicxml+xml'
    const blob = new Blob([new Uint8Array(z.bita)], { type: mime })
    hasil.push({
      songId,
      namaFile,
      tipe,
      blob,
      ukuran: typeof m?.ukuran === 'number' && Number.isFinite(m.ukuran) ? m.ukuran : blob.size,
      hash: typeof m?.hash === 'string' ? m.hash : '',
    })
  }
  return hasil
}
