/**
 * #11a — Panel Partitur: pasang, ringkas, lepas, kuota.
 *
 * **Batas yang dipegang.** Panel ini tidak merender satu not pun — itu 11b.
 * Ia hanya mengurus berkasnya: memilih, memeriksa, menyimpan, menampilkan
 * ringkasan yang sudah dihitung pemindai murni (`ringkasMusicXml`), dan
 * melepasnya kembali.
 *
 * **Dua peran, satu panel.** Pelatih memasang notasi dan anggota membukanya di
 * perangkatnya sendiri; karena itu panel ini juga hidup di mode anggota
 * (`aturMode` pintu #7 sengaja mengizinkan partitur di kedua mode). Bedanya
 * hanya pada tata kelola berkasnya, sama seperti `ModalRekamanLagu` #6:
 *
 * - keduanya boleh **menambahkan** berkas — anggota sering hanya menerima
 *   metadatanya lewat paket/show dan perlu memasang bitanya sendiri di HP-nya;
 * - hanya pelatih yang boleh **mengganti** dan **melepas**, sebab itu
 *   mengubah apa yang dibaca seluruh tim dari lagu ini.
 *
 * **Pratinjau dulu, tulis kemudian** (prinsip yang sama dengan impor #10):
 * berkas yang dipilih diperiksa dan diringkas di memori, ditampilkan, dan
 * baru ditulis setelah pelatih menekan Pasang. Di #11b, arsip `.mxl` yang sah
 * diurai otomatis menjadi `.musicxml` tak terkompresi di pratinjau, sementara
 * berkas yang rusak berhenti di sini tanpa satu baris pun ditulis.
 *
 * **Urutan yang menjaga data (§8).** Melepas = metadata lagu dikosongkan
 * **dulu**, Blob dihapus **kemudian**. Mengganti tidak menghapus apa pun
 * lebih dulu: kunci store adalah `songId`, jadi penimpaan Blob lama terjadi
 * dalam satu langkah dan tidak pernah ada jendela "dua-duanya hilang".
 */
import { useEffect, useRef, useState } from 'react'
import type { PartiturMeta, Song } from '../db/types'
import { cekPenyimpanan, mintaPenyimpananPersisten, type InfoPenyimpanan } from '../lib/rekaman'
import {
  hapusPartiturBerkas,
  metaDariPutusan,
  muatPartiturBerkas,
  periksaPartitur,
  simpanPartiturBerkas,
} from '../lib/partiturSimpan'
import { formatBytes } from '../lib/backup'
import { Button, ConfirmButton, useToast } from './ui'
import { IconEye, IconUpload } from './Icons'

/** Pratinjau berkas yang baru dipilih, sebelum apa pun ditulis. */
interface PilihanPartitur {
  namaFile: string
  /** Nama berkas asli bila dikonversi dari `.mxl` (mis. `pembuka.mxl`). */
  namaAsli?: string
  ukuran: number
  hash: string
  /** Metadata yang AKAN disimpan — sekaligus bahan ringkasannya. */
  meta: PartiturMeta
  /** Berkas siap simpan; belum masuk IndexedDB sampai ditekan Pasang. */
  blob: Blob
}

/** Sukat sebagai "7/8". */
function formatSukat(beats: number, beatType: number): string {
  return `${beats}/${beatType}`
}

export function PanelPartitur({
  song,
  onUpdateSong,
  hanyaPutar = false,
  terbuka = false,
  onToggleBuka,
}: {
  song: Song
  /** Tulis `Song.partitur` — bentuk yang sama dengan `onUpdateSong` #6. */
  onUpdateSong: (songId: string, meta: PartiturMeta | null) => Promise<void>
  hanyaPutar?: boolean
  /** #11b — apakah panel baca `LayarPartitur` sedang ditampilkan untuk lagu ini. */
  terbuka?: boolean
  /** #11b — buka/sembunyikan panel baca `LayarPartitur`. */
  onToggleBuka?: () => void
}) {
  const toast = useToast()
  const [pilihan, setPilihan] = useState<PilihanPartitur | null>(null)
  const [tolak, setTolak] = useState<string | null>(null)
  const [adaBerkas, setAdaBerkas] = useState<boolean | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [storage, setStorage] = useState<InfoPenyimpanan | null>(null)
  const [tampilKuota, setTampilKuota] = useState(false)
  /** Satu input untuk semua tombol: yang membuka pemilih berkas selalu sama. */
  const inputRef = useRef<HTMLInputElement | null>(null)

  const meta = song.partitur ?? null

  // Blob-nya ada di perangkat ini atau tidak. Ini pertanyaan yang berbeda dari
  // "lagunya punya partitur" (§3.2): anggota bisa punya metadatanya tanpa
  // bitanya, dan keadaan itu harus terbaca apa adanya — bukan error.
  useEffect(() => {
    let hidup = true
    setPilihan(null)
    setTolak(null)
    setAdaBerkas(null)
    if (!meta) {
      setAdaBerkas(false)
      return
    }
    void muatPartiturBerkas(song.id).then((item) => {
      if (hidup) setAdaBerkas(!!item?.blob)
    })
    return () => {
      hidup = false
    }
    // Sengaja hanya pada lagu & keberadaan metadata: mengganti isi berkas
    // tidak mengubah pertanyaan "ada atau tidak".
  }, [song.id, meta?.hash, meta?.namaFile])

  async function pilihBerkas(f: File) {
    setSibuk(true)
    setTolak(null)
    try {
      const { putusan, hash, ukuran, blobSiap, namaSimpan, dariMxl } = await periksaPartitur(f, f.name)
      if (!putusan.boleh) {
        // Berkas tidak sah / .mxl rusak berhenti di sini; tidak ada yang ditulis.
        setPilihan(null)
        setTolak(putusan.alasan ?? 'Berkas ini tidak bisa dipasang sebagai partitur.')
        return
      }
      setPilihan({
        namaFile: namaSimpan,
        namaAsli: dariMxl && namaSimpan !== f.name ? f.name : undefined,
        ukuran,
        hash,
        meta: metaDariPutusan(namaSimpan, ukuran, hash, putusan, Date.now()),
        blob: blobSiap,
      })
    } catch {
      setTolak('Berkasnya tidak bisa dibaca dari perangkat ini.')
    } finally {
      setSibuk(false)
    }
  }

  async function pasang() {
    if (!pilihan) return
    setSibuk(true)
    try {
      const { meta: metaBaru } = await simpanPartiturBerkas(song.id, pilihan.blob, pilihan.namaFile)
      await onUpdateSong(song.id, metaBaru)
      setPilihan(null)
      setAdaBerkas(true)
      toast.push(meta ? 'Partitur diganti' : 'Partitur dipasang')
      void cekPenyimpanan().then(setStorage)
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Partitur gagal disimpan', 'err')
    } finally {
      setSibuk(false)
    }
  }

  async function lepas() {
    setSibuk(true)
    try {
      // §8 — metadata dulu, Blob kemudian.
      if (terbuka) onToggleBuka?.()
      await onUpdateSong(song.id, null)
      await hapusPartiturBerkas(song.id)
      setAdaBerkas(false)
      setPilihan(null)
      toast.push('Partitur dilepas')
    } catch {
      toast.push('Partitur gagal dilepas', 'err')
    } finally {
      setSibuk(false)
    }
  }

  /** Kuota diperiksa sekali di sini; di atas 50% peringatannya ditampilkan. */
  useEffect(() => {
    void cekPenyimpanan().then((info) => {
      setStorage(info)
      const persen =
        info.terpakaiMb != null && info.kuotaMb
          ? (info.terpakaiMb / info.kuotaMb) * 100
          : 0
      if (persen > 50) setTampilKuota(true)
    })
  }, [song.id, meta?.hash])

  const metaTampil = pilihan?.meta ?? meta
  const tipe: 'musicxml' | 'pdf' | undefined = pilihan?.meta.tipe ?? meta?.tipe

  return (
    <div data-testid="panel-partitur" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-slate-300">Partitur — {song.title}</p>
          <p className="mt-0.5 text-[11px] text-slate-500">
            MusicXML (.musicxml / .mxl) atau PDF dari MuseScore/Sibelius/Finale. Disimpan offline di perangkat ini.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {/*
            Satu input berkas untuk semua tombol (`#partitur-input`), dibuka
            lewat ref — pola yang sama dengan pintu #7 & ModalRekamanLagu, dan
            yang dipakai rangkaian uji peramban (`uploadFile` ke id-nya).
          */}
          <input
            ref={inputRef}
            id="partitur-input"
            type="file"
            accept=".musicxml,.mxl,.xml,.pdf"
            className="hidden"
            data-testid="partitur-pilih"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) void pilihBerkas(f)
            }}
          />
          {meta && adaBerkas === true && !pilihan && onToggleBuka && (
            <Button
              variant={terbuka ? 'soft' : 'primary'}
              size="sm"
              disabled={sibuk}
              data-testid="partitur-buka"
              data-kiosk-allow
              onClick={onToggleBuka}
            >
              <IconEye size={14} /> {terbuka ? 'Sembunyikan partitur' : 'Buka partitur'}
            </Button>
          )}
          {meta && !hanyaPutar && (
            // Mengganti menyentuh apa yang dibaca seluruh tim, jadi dua
            // langkah — dan pesannya menyebut berkas lama (§8).
            <ConfirmButton
              label={adaBerkas ? 'Ganti berkas' : 'Pasang berkas'}
              message={`Ganti "${meta.namaFile}"?`}
              testId="partitur-ganti"
              disabled={sibuk}
              onConfirm={() => inputRef.current?.click()}
            />
          )}
          {meta && hanyaPutar && (
            <Button
              variant="soft"
              size="sm"
              disabled={sibuk}
              data-testid="partitur-tambah"
              onClick={() => inputRef.current?.click()}
            >
              <IconUpload size={13} /> {adaBerkas ? 'Ganti berkas' : 'Tambahkan dari pelatih'}
            </Button>
          )}
          {!meta && (
            <Button
              variant="primary"
              size="sm"
              disabled={sibuk}
              data-testid="partitur-pasang"
              onClick={() => inputRef.current?.click()}
            >
              <IconUpload size={14} /> {sibuk ? 'Memeriksa…' : 'Pilih berkas'}
            </Button>
          )}
          {meta && !hanyaPutar && (
            <ConfirmButton
              label="Lepas"
              message="Hapus partitur ini?"
              testId="partitur-hapus"
              disabled={sibuk}
              onConfirm={() => void lepas()}
            />
          )}
        </div>
      </div>

      {/* Berkas ditolak — pesannya apa adanya, tanpa diparafrase. */}
      {tolak && (
        <div
          data-testid="partitur-tolak"
          className="rounded-lg border border-amber-600/40 bg-amber-950/20 p-2.5 text-[11px] leading-relaxed text-amber-100/90"
        >
          {tolak}
          <span className="mt-1 block text-slate-400">Berkasnya belum disimpan.</span>
        </div>
      )}

      {/* Belum ada partitur sama sekali. */}
      {!metaTampil && !tolak && (
        <p data-testid="partitur-tak-ada" className="rounded-lg bg-slate-950/50 p-2.5 text-[11px] text-slate-500">
          Belum ada partitur untuk lagu ini. Pilih berkasnya untuk dipasang — isinya diringkas lebih dulu sebelum
          disimpan.
        </p>
      )}

      {/* Pratinjau berkas yang baru dipilih, belum ditulis. */}
      {pilihan && (
        <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-2.5">
          <p className="text-[11px] font-semibold text-emerald-200">
            Belum disimpan — periksa dulu ringkasannya
          </p>
          <p className="mt-0.5 break-all text-[11px] text-slate-400">
            {pilihan.namaAsli ? `${pilihan.namaAsli} → ${pilihan.namaFile}` : pilihan.namaFile} ·{' '}
            {formatBytes(pilihan.ukuran)} · SHA: {pilihan.hash.slice(0, 10)}…
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="primary" size="sm" disabled={sibuk} data-testid="partitur-simpan" onClick={() => void pasang()}>
              {meta ? 'Pasang (ganti yang lama)' : 'Pasang partitur'}
            </Button>
            <Button variant="ghost" size="sm" disabled={sibuk} data-testid="partitur-batal" onClick={() => setPilihan(null)}>
              Batal
            </Button>
          </div>
        </div>
      )}

      {/* Ringkasan: satu sumber, dari metadata lagu atau dari berkas yang baru dipilih. */}
      {metaTampil && <RingkasPartitur meta={metaTampil} tipe={tipe} namaFile={pilihan?.namaFile ?? meta?.namaFile ?? ''} />}

      {/* Keadaan yang harus terbaca apa adanya, bukan error: metadata ada,
          bitanya tidak ada di perangkat ini. */}
      {meta && adaBerkas === false && (
        <p
          data-testid="partitur-tak-ada"
          className="rounded-lg border border-sky-800/50 bg-sky-950/20 p-2.5 text-[11px] leading-relaxed text-sky-200/90"
        >
          Partitur <b>tercatat</b> ({meta.namaFile}), tetapi <b>berkasnya belum ada di perangkat ini</b>. Minta
          berkasnya dari pelatih, lalu pasang lewat tombol di atas — atau pulihkan dari backup lengkap (ZIP) yang
          memuat folder <code>partitur/</code>.
        </p>
      )}

      {/* Kuota (§6 butir 3). Nadanya mengikuti ModalRekamanLagu. */}
      <div
        data-testid="partitur-kuota"
        className="rounded-lg border border-slate-800 bg-slate-900/50 p-2.5 text-[11px] text-slate-400"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span>
            Penyimpanan browser:{' '}
            {storage?.terpakaiMb ? `${storage.terpakaiMb} MB terpakai` : 'Tersedia'}
            {storage?.persisten ? ' · Persisten ✔' : ' · Belum persisten'}
          </span>
          {!storage?.persisten && (
            <Button
              size="sm"
              variant="soft"
              data-testid="partitur-persisten"
              onClick={async () => {
                const ok = await mintaPenyimpananPersisten()
                if (ok) {
                  toast.push('Penyimpanan persisten diizinkan')
                  void cekPenyimpanan().then(setStorage)
                } else {
                  toast.push('Peramban belum mengizinkan persisten otomatis', 'err')
                }
              }}
            >
              Minta Persisten
            </Button>
          )}
        </div>
        {tampilKuota && (
          <p data-testid="partitur-kuota-ingat" className="mt-1 text-amber-400/90">
            Penyimpanan browser sudah terpakai lebih dari separuh. Partitur & rekaman besar sebaiknya dipasang
            per-lagu saja, dan berkas lama dilepas setelah tidak dipakai.
          </p>
        )}
        {storage?.pesanIos && <p className="mt-1 text-amber-400/90">{storage.pesanIos}</p>}
      </div>
    </div>
  )
}

/**
 * Ringkasan isi partitur. Untuk PDF, apa adanya: tidak ada yang bisa
 * diringkas, dan itu **bukan** kegagalan. Untuk XML yang menjegal pemindai
 * (D4), pesannya ditampilkan mentah — pelatih harus bisa memutuskan sendiri.
 */
function RingkasPartitur({
  meta,
  tipe,
  namaFile,
}: {
  meta: PartiturMeta
  tipe?: 'musicxml' | 'pdf'
  namaFile: string
}) {
  const baris: { label: string; nilai: string }[] = []
  if (meta.terurai) {
    if (meta.judul) baris.push({ label: 'Judul', nilai: meta.judul })
    if (meta.pengarang) baris.push({ label: 'Pengarang', nilai: meta.pengarang })
    baris.push({ label: 'Birama', nilai: String(meta.jumlahBirama) })
    baris.push({ label: 'Part', nilai: `${meta.jumlahPart}` })
    if (meta.sukat) {
      const ubah = meta.perubahanSukat
      baris.push({
        label: 'Sukat',
        nilai:
          ubah.length > 1
            ? `${formatSukat(meta.sukat.beats, meta.sukat.beatType)} (${ubah.length} bagian: ${ubah
                .map((u) => `${formatSukat(u.beats, u.beatType)}@${u.birama}`)
                .join(', ')})`
            : formatSukat(meta.sukat.beats, meta.sukat.beatType),
      })
    }
    if (meta.tempo != null) baris.push({ label: 'Tempo', nilai: `${meta.tempo} BPM` })
    if (meta.susunan) baris.push({ label: 'Susunan', nilai: meta.susunan })
  }

  return (
    <div data-testid="partitur-ringkas" className="rounded-lg border border-slate-800 bg-slate-950/50 p-2.5">
      <p className="break-all text-[11px] text-slate-400">
        {namaFile} · {formatBytes(meta.ukuran)}
        {tipe === 'pdf' ? ' · PDF' : ' · MusicXML'}
      </p>
      {baris.length > 0 && (
        <dl className="mt-2 grid grid-cols-[6rem_1fr] gap-x-2 gap-y-1 text-[11px]">
          {baris.map((b) => (
            <div key={b.label} className="contents">
              <dt className="text-slate-500">{b.label}</dt>
              <dd className="break-words text-slate-200">{b.nilai}</dd>
            </div>
          ))}
        </dl>
      )}
      {meta.terurai && meta.parts.length > 0 && (
        <div data-testid="partitur-part" className="mt-2 flex flex-wrap gap-1">
          {meta.parts.map((p) => (
            <span
              key={p.id}
              className="rounded-full border border-slate-700 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300"
            >
              {p.singkatan ? `${p.singkatan} — ${p.nama}` : p.nama}
            </span>
          ))}
        </div>
      )}
      {tipe === 'pdf' && !meta.terurai && (
        <p className="mt-2 text-[11px] leading-relaxed text-slate-400">
          PDF — isinya tidak bisa diringkas DrillKit (belum ada render di 11a), tetapi berkasnya tersimpan utuh dan
          ikut terbawa di backup ZIP.
        </p>
      )}
      {tipe !== 'pdf' && !meta.terurai && (
        <p className="mt-2 text-[11px] leading-relaxed text-amber-100/90">
          Berkasnya <b>tersimpan</b>, tetapi pemindai DrillKit belum sanggup meringkas isinya. Ini tidak menghalangi
          apa pun: perender notasi (11b) memakai pengurai XML sungguhan.
          {meta.ringkasGagal && <span className="mt-1 block text-slate-400">Sebabnya: {meta.ringkasGagal}</span>}
        </p>
      )}
    </div>
  )
}
