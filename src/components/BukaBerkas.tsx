/**
 * #7 / #12a — satu pintu "Buka berkas DrillKit" (cangkang ringan).
 *
 * Cara pakai:
 * - Tombol: `<TombolBukaBerkas />` — dipasang di menu Data & Dashboard.
 * - Global: `<PratinjauGlobal />` + `<LapisanSeretBerkas />` — dipasang
 *   sekali di `Layout`, supaya tombol LAMA pun bisa mengalihkan berkas yang
 *   bukan jenisnya ke pratinjau yang benar lewat `mintaPratinjau()`.
 * - Lintas halaman: `titipBerkas()` + `ambilTitipan()` — pratinjau menitipkan
 *   berkasnya lalu pindah rute, halaman tujuan mengambil & meneruskannya ke
 *   alur yang sudah ada (impor Data, impor CSV, ...).
 *
 * #12a: Pengurai berkas (`bukaBerkas`, `pyware`, `partitur`, `mxl`, `zip`)
 * dan tubuh modal pratinjau (`PratinjauBerkasModal`) kini dimuat malas hanya
 * ketika pengguna benar-benar memilih atau menyeret berkas, sehingga halaman
 * pertama aplikasi jauh lebih ringan.
 */
import { Suspense, lazy, useEffect, useState } from 'react'
import type { BerkasDikenal, JenisBerkas } from '../lib/bukaBerkas'
import { Button, Modal, useToast } from './ui'
import { IconUpload } from './Icons'

const TubuhPratinjauMalas = lazy(() => import('./PratinjauBerkasModal'))

/* ------------------------- Bus pratinjau global -------------------------- */

export interface PaketPratinjau {
  hasil: BerkasDikenal
  /** Bita mentah (ZIP) — dibutuhkan untuk mengekstrak audio saat pulihkan. */
  bita?: Uint8Array
}

type Pendengar = (paket: PaketPratinjau | null) => void
const pendengar = new Set<Pendengar>()
let paketSaatIni: PaketPratinjau | null = null

function siarkan(paket: PaketPratinjau | null): void {
  paketSaatIni = paket
  for (const fn of pendengar) fn(paket)
}

/**
 * Minta pratinjau global dibuka untuk berkas ini.
 *
 * Dipakai tombol baru DAN tombol lama yang menerima berkas di luar jenisnya
 * ("mengalihkan ke pratinjau yang benar").
 */
export function mintaPratinjau(hasil: BerkasDikenal, bita?: Uint8Array): void {
  // #11b — tombol lama memanggil `kenaliBerkas` sinkron (yang menandai .mxl
  // dengan pesan MusicXML terkompresi). Urai secara asinkron di sini supaya
  // semua tombol lama ikut mengenali .mxl tanpa menarik mxl/partitur di awal.
  if (bita && hasil.jenis === 'tak-dikenal' && hasil.catatan?.includes('MusicXML terkompresi (.mxl)')) {
    void Promise.all([import('../lib/bukaBerkas'), import('./PratinjauBerkasModal')]).then(
      ([{ kenaliBerkasAsync }]) =>
        kenaliBerkasAsync(hasil.nama, bita).then((baru) => {
          siarkan({ hasil: baru, bita })
        }),
    )
    return
  }
  // Muat potongan kode `PratinjauBerkasModal` lebih dulu sebelum menyiarkan
  // modal, sehingga begitu `[data-testid="modal-buka-berkas"]` muncul di DOM,
  // seluruh isi (`buka-jenis`, `buka-tolak`, `buka-lanjut`) sudah siap tampil
  // pada frame pertama tanpa jeda fallback `<Suspense>`.
  void import('./PratinjauBerkasModal').then(() => {
    siarkan({ hasil, bita })
  })
}

export function tutupPratinjau(): void {
  siarkan(null)
}

function langgananPratinjau(fn: Pendengar): () => void {
  pendengar.add(fn)
  return () => {
    pendengar.delete(fn)
  }
}

/* ------------------------------ Titipan ---------------------------------- */

/** Berkas yang dititipkan pratinjau untuk halaman tujuan. */
export interface TitipanBerkas {
  jenis: JenisBerkas
  nama: string
  teks: string
}

let titipan: TitipanBerkas | null = null

export function titipBerkas(t: TitipanBerkas): void {
  titipan = t
  try {
    window.dispatchEvent(new CustomEvent('drillkit:titipan'))
  } catch {
    // bukan peramban — abaikan
  }
}

/** Intip titipan tanpa mengambilnya (untuk memilih tab sebelum mount). */
export function intipTitipan(): TitipanBerkas | null {
  return titipan
}

/**
 * Ambil titipan bila jenisnya cocok (sekali ambil, langsung hangus).
 * Tanpa argumen: ambil apa pun yang ada.
 */
export function ambilTitipan(boleh?: JenisBerkas[]): TitipanBerkas | null {
  if (!titipan) return null
  if (boleh && !boleh.includes(titipan.jenis)) return null
  const t = titipan
  titipan = null
  return t
}

/**
 * Pakai titipan: ambil yang menunggu saat dipasang, lalu dengarkan yang
 * datang kemudian. Sekali ambil langsung hangus (tidak diproses dua kali).
 */
export function useTitipan(boleh: JenisBerkas[], cb: (t: TitipanBerkas) => void): void {
  useEffect(() => {
    const cek = () => {
      const t = ambilTitipan(boleh)
      if (t) cb(t)
    }
    cek()
    window.addEventListener('drillkit:titipan', cek)
    return () => window.removeEventListener('drillkit:titipan', cek)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
}

/* ------------------------------ Kenali ----------------------------------- */

/** Baca `File` dari pemilih/seretan lalu kenali dari isinya (memuat pengurai saat diperlukan). */
export async function kenaliFile(file: File): Promise<{ hasil: BerkasDikenal; bita: Uint8Array }> {
  const [ab, { kenaliBerkasAsync }] = await Promise.all([
    file.arrayBuffer(),
    import('../lib/bukaBerkas'),
  ])
  const bita = new Uint8Array(ab)
  return { hasil: await kenaliBerkasAsync(file.name, bita), bita }
}

/* --------------------------- Tombol pintu baru --------------------------- */

export function TombolBukaBerkas({
  label = 'Buka berkas DrillKit',
  variant = 'primary',
  size: _ukuran = 'md',
  testId = 'buka-berkas',
  petunjuk = true,
}: {
  label?: string
  variant?: 'primary' | 'ghost' | 'outline'
  size?: 'sm' | 'md'
  testId?: string
  petunjuk?: boolean
}) {
  const toast = useToast()
  return (
    <span className="inline-flex flex-col gap-1">
      <label
        data-testid={testId}
        className="inline-flex cursor-pointer items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium"
        style={
          variant === 'primary'
            ? { backgroundColor: '#059669', color: '#ffffff' }
            : variant === 'outline'
              ? { border: '1px solid #475569', color: '#e2e8f0' }
              : { color: '#e2e8f0' }
        }
        title="Buka berkas apa pun — backup, data, show, lagu, paket, CSV, ZIP, partitur (MusicXML/PDF). Jenisnya dikenali otomatis."
      >
        <IconUpload size={16} /> {label}
        <input
          type="file"
          accept=".json,.csv,.zip,.musicxml,.mxl,.xml,.pdf,application/json,text/csv,application/zip,application/pdf,application/vnd.recordare.musicxml"
          data-testid={`${testId}-input`}
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            e.target.value = ''
            if (!f) return
            void kenaliFile(f)
              .then(({ hasil, bita }) => mintaPratinjau(hasil, bita))
              .catch(() => toast.push('Berkas tidak bisa dibaca', 'err'))
          }}
        />
      </label>
      {petunjuk && (
        <span className="text-[11px] text-slate-500">
          Backup, data, show, lagu, paket, CSV, ZIP, partitur — jenisnya dikenali otomatis.
        </span>
      )}
    </span>
  )
}

/* --------------------------- Pratinjau global ---------------------------- */

export function PratinjauGlobal() {
  const [paket, setPaket] = useState<PaketPratinjau | null>(() => paketSaatIni)
  useEffect(() => langgananPratinjau(setPaket), [])
  if (paket == null) return null
  return (
    <Modal
      open
      onClose={tutupPratinjau}
      title="Buka berkas DrillKit"
      wide
      testId="modal-buka-berkas"
      footer={
        <Button variant="ghost" data-testid="buka-tutup" onClick={tutupPratinjau}>
          Tutup
        </Button>
      }
    >
      <Suspense fallback={<p className="text-xs text-slate-400">Memuat pratinjau berkas…</p>}>
        <TubuhPratinjauMalas paket={paket} onTutup={tutupPratinjau} />
      </Suspense>
    </Modal>
  )
}

/* ------------------------- Seret & letakkan (laptop) ---------------------- */

export function LapisanSeretBerkas() {
  const [tampil, setTampil] = useState(false)
  const toast = useToast()

  useEffect(() => {
    let hitung = 0
    const bawaBerkas = (e: DragEvent) => [...(e.dataTransfer?.types ?? [])].includes('Files')
    const masuk = (e: DragEvent) => {
      if (!bawaBerkas(e)) return
      e.preventDefault()
      hitung += 1
      setTampil(true)
    }
    const lewat = (e: DragEvent) => {
      if (!bawaBerkas(e)) return
      e.preventDefault()
    }
    const keluar = (e: DragEvent) => {
      if (!bawaBerkas(e)) return
      hitung = Math.max(0, hitung - 1)
      if (hitung === 0) setTampil(false)
    }
    const lepas = (e: DragEvent) => {
      if (!bawaBerkas(e)) return
      e.preventDefault()
      hitung = 0
      setTampil(false)
      const f = e.dataTransfer?.files?.[0]
      if (!f) return
      void kenaliFile(f)
        .then(({ hasil, bita }) => mintaPratinjau(hasil, bita))
        .catch(() => toast.push('Berkas tidak bisa dibaca', 'err'))
    }
    window.addEventListener('dragenter', masuk)
    window.addEventListener('dragover', lewat)
    window.addEventListener('dragleave', keluar)
    window.addEventListener('drop', lepas)
    return () => {
      window.removeEventListener('dragenter', masuk)
      window.removeEventListener('dragover', lewat)
      window.removeEventListener('drop', lepas)
    }
  }, [toast])

  if (!tampil) return null
  return (
    <div
      data-testid="lapisan-seret"
      className="fixed inset-0 z-[230] flex items-center justify-center bg-slate-950/80 p-6"
    >
      <div className="rounded-2xl border-2 border-dashed border-emerald-500/60 bg-slate-900/90 px-10 py-14 text-center">
        <p className="text-base font-semibold text-slate-100">Lepaskan berkasnya di sini</p>
        <p className="mt-1 text-xs text-slate-400">
          Backup, data, show, lagu, paket, CSV, ZIP, partitur — jenisnya dikenali otomatis.
        </p>
      </div>
    </div>
  )
}
