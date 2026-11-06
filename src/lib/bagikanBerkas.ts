/**
 * #30 — "Bagikan langsung": lempar berkas ke lembar berbagi sistem operasi
 * (Quick Share Android, AirDrop iOS, WhatsApp, Telegram, …) lewat
 * `navigator.share({ files })` — tanpa mencari berkas di pengelola unduhan.
 *
 * Hanya tampil bila peramban sungguh mendukung berbagi BERKAS (bukan sekadar
 * tautan). Selalu berdampingan dengan tombol Unduh yang sudah ada — tidak
 * menggantikannya.
 */

export type HasilBagikan = 'dibagikan' | 'batal' | 'tak-didukung' | 'gagal'

interface NavigatorBerbagi {
  share?: (data: { files?: File[]; title?: string; text?: string }) => Promise<void>
  canShare?: (data: { files?: File[] }) => boolean
}

function nav(): NavigatorBerbagi | null {
  return typeof navigator === 'undefined' ? null : (navigator as unknown as NavigatorBerbagi)
}

/** Tebak MIME dari nama berkas (dipakai lembar berbagi untuk memilih aplikasi). */
export function mimeDariNama(nama: string): string {
  const n = nama.toLowerCase()
  if (n.endsWith('.json')) return 'application/json'
  if (n.endsWith('.zip')) return 'application/zip'
  if (n.endsWith('.csv')) return 'text/csv'
  if (n.endsWith('.html')) return 'text/html'
  if (n.endsWith('.pdf')) return 'application/pdf'
  return 'application/octet-stream'
}

let dukunganTersimpan: boolean | null = null

/** Apakah peramban ini bisa membagikan berkas lewat lembar berbagi OS? */
export function bisaBagikanBerkas(): boolean {
  if (dukunganTersimpan !== null) return dukunganTersimpan
  const n = nav()
  let ok = false
  try {
    if (n?.share && n.canShare && typeof File === 'function') {
      ok = n.canShare({ files: [new File(['{}'], 'uji.json', { type: 'application/json' })] })
    }
  } catch {
    ok = false
  }
  dukunganTersimpan = ok
  return ok
}

/** Bagikan satu berkas. `batal` = pemakai menutup lembar berbagi. */
export async function bagikanBerkas(opsi: {
  nama: string
  isi: string | Uint8Array
  mime?: string
  judul?: string
  teks?: string
}): Promise<HasilBagikan> {
  const n = nav()
  if (!n?.share || !n.canShare) return 'tak-didukung'
  const mime = opsi.mime ?? mimeDariNama(opsi.nama)
  const bagian: BlobPart = typeof opsi.isi === 'string' ? opsi.isi : new Uint8Array(opsi.isi)
  const file = new File([bagian], opsi.nama, { type: mime })
  try {
    if (!n.canShare({ files: [file] })) return 'tak-didukung'
    await n.share({ files: [file], title: opsi.judul ?? opsi.nama, text: opsi.teks })
    return 'dibagikan'
  } catch (e) {
    return (e as { name?: string })?.name === 'AbortError' ? 'batal' : 'gagal'
  }
}
