/**
 * #7 / #12a — Tubuh modal pratinjau "Buka berkas DrillKit" (dimuat malas).
 *
 * Dipisahkan dari `BukaBerkas.tsx` supaya pintu ringan (`TombolBukaBerkas`,
 * `PratinjauGlobal`, `LapisanSeretBerkas`) di `Layout` dan `Dashboard` tidak
 * menyeret pengurai berkas berat (`bukaBerkas`, `PulihkanBackup`, `ImporShow`,
 * `pyware`, `partitur`, `mxl`, `zip`) ke bundel JS halaman pertama.
 */
import { Fragment, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../db/db'
import { useMemberMode } from '../hooks/useMemberMode'
import {
  LABEL_JENIS,
  TUJUAN_JENIS,
  aturMode,
  ringkasCsv,
  ringkasDataPindah,
  ringkasPaket,
  type BerkasDikenal,
} from '../lib/bukaBerkas'
import { pulihkanAudioDariZipPaket, simpanPaketAnggota } from '../lib/paketMasuk'
import { cekBerkas, type BerkasShow } from '../lib/show'
import { bacaPaket, perluPeringatan, ringkasanImpor, terapkanPaket } from '../lib/repertoar'
import type { PaketRepertoar } from '../db/types'
import { Button, useToast } from './ui'
import { AlurPulihkanBackup, ekstrakAudioZip, ekstrakPartiturZip } from './PulihkanBackup'
import { AlurImporShow } from './ImporShow'
import { titipBerkas, type PaketPratinjau } from './BukaBerkas'

/** Kepala pratinjau: jenis + nama + tanggal + catatan. Selalu tampil. */
function KepalaPratinjau({ hasil }: { hasil: BerkasDikenal }) {
  const tanggal =
    hasil.tanggal != null
      ? new Date(hasil.tanggal).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : null
  return (
    <div className="mb-3 rounded-lg bg-slate-950/50 p-3">
      <p data-testid="buka-jenis" className="text-sm font-semibold text-slate-100">
        {LABEL_JENIS[hasil.jenis]}
      </p>
      <p data-testid="buka-nama" className="mt-0.5 break-all text-[11px] text-slate-500">
        {hasil.nama}
      </p>
      {tanggal && (
        <p data-testid="buka-tanggal" className="mt-0.5 text-[11px] text-slate-400">
          Dibuat {tanggal}
        </p>
      )}
      {hasil.catatan && (
        <p data-testid="buka-catatan" className="mt-1 text-[11px] leading-relaxed text-slate-500">
          {hasil.catatan}
        </p>
      )}
    </div>
  )
}

export default function TubuhPratinjau({
  paket,
  onTutup,
}: {
  paket: PaketPratinjau
  onTutup: () => void
}) {
  const mode = useMemberMode()
  const { hasil } = paket

  if (hasil.jenis === 'tak-dikenal') {
    return (
      <>
        <KepalaPratinjau hasil={hasil} />
        <TubuhTakDikenal hasil={hasil} />
      </>
    )
  }

  const jumlahPaket = hasil.jenis === 'zip-anggota' ? (hasil.daftarZip?.length ?? 0) : 0
  const gate = aturMode(hasil.jenis, mode, jumlahPaket)
  if (!gate.boleh) {
    return (
      <>
        <KepalaPratinjau hasil={hasil} />
        <TubuhTolak alasan={gate.alasan} />
      </>
    )
  }

  // ZIP berisi tepat satu paket di mode anggota = paket biasa.
  const dataPaket =
    hasil.jenis === 'zip-anggota' && hasil.daftarZip?.length === 1
      ? (hasil.daftarZip[0].data as Parameters<typeof ringkasPaket>[0])
      : undefined

  return (
    <>
      <KepalaPratinjau hasil={hasil} />
      {(hasil.jenis === 'backup' || hasil.jenis === 'zip-backup') && (
        <AlurPulihkanBackup
          data={(hasil.data ?? {}) as Record<string, any>}
          audio={paket.bita ? ekstrakAudioZip(paket.bita) : []}
          partitur={paket.bita ? ekstrakPartiturZip(paket.bita) : []}
          namaBerkas={hasil.nama}
          testId="buka-pulih"
          onSelesai={onTutup}
        />
      )}
      {hasil.jenis === 'data' && <TubuhData hasil={hasil} onTutup={onTutup} />}
      {hasil.jenis === 'show' && <TubuhShow hasil={hasil} onTutup={onTutup} />}
      {hasil.jenis === 'repertoar' && <TubuhRepertoar hasil={hasil} onTutup={onTutup} />}
      {(hasil.jenis === 'paket' || dataPaket !== undefined) && (
        <TubuhPaket
          hasil={hasil}
          data={(dataPaket ?? hasil.data) as Record<string, unknown>}
          bitaZip={paket.bita}
          onTutup={onTutup}
        />
      )}
      {hasil.jenis.startsWith('csv-') && <TubuhCsv hasil={hasil} onTutup={onTutup} />}
      {hasil.jenis === 'partitur' && <TubuhPartitur hasil={hasil} />}
    </>
  )
}

/* ------------------------------ Tiap jenis ------------------------------- */

function TubuhTolak({ alasan }: { alasan: string }) {
  return (
    <div
      data-testid="buka-tolak"
      className="rounded-lg border border-amber-600/40 bg-amber-950/20 p-3 text-xs leading-relaxed text-amber-100/90"
    >
      <p className="font-semibold">Berkas ini tidak bisa dibuka di sini</p>
      <p className="mt-1">{alasan}</p>
    </div>
  )
}

function TubuhTakDikenal({ hasil }: { hasil: BerkasDikenal }) {
  const buka: { jenis: string; tempat: string }[] = [
    { jenis: 'Backup lengkap (.json/.zip)', tempat: 'Pengaturan → Pulihkan backup' },
    { jenis: 'Data pilihan (.json)', tempat: 'menu Data' },
    { jenis: 'Show antar pelatih (.json)', tempat: 'Drill → ⚙ → Berbagi show' },
    { jenis: 'Lagu/repertoar (.json)', tempat: 'Musik → Tukar repertoar' },
    { jenis: 'Paket anggota (.json)', tempat: 'mode anggota → Buka paket tim' },
    { jenis: 'CSV anggota / koordinat / jadwal / absensi', tempat: 'menu masing-masing' },
  ]
  return (
    <div data-testid="buka-tak-dikenal">
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 text-xs leading-relaxed text-slate-300">
        <p className="font-semibold text-slate-100">Berkas ini tidak dikenali</p>
        <p className="mt-1 text-slate-400">
          {hasil.catatan ?? 'Bukan JSON, CSV, atau ZIP DrillKit.'} Tidak ada yang diubah.
        </p>
      </div>
      <p className="mb-1 mt-3 text-[11px] font-semibold text-slate-400">
        Yang bisa dibuka DrillKit:
      </p>
      <ul className="space-y-1">
        {buka.map((b) => (
          <li key={b.jenis} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="text-slate-300">{b.jenis}</span>
            <span className="text-right text-slate-500">{b.tempat}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Data pilihan: pratinjau di sini, penerapannya di menu Data (ada cocoknya). */
function TubuhData({ hasil, onTutup }: { hasil: BerkasDikenal; onTutup: () => void }) {
  const navigate = useNavigate()
  const [idLokal, setIdLokal] = useState<Record<string, string[]> | null>(null)

  useEffect(() => {
    let hidup = true
    ;(async () => {
      const kunci = (daftar: { id?: string; key?: string }[]) =>
        daftar.map((e) => e?.id ?? e?.key ?? '').filter(Boolean)
      const [anggota, jadwal, absensi, lagu, setlist, drill, set, kemajuan, catatan, evaluasi] =
        await Promise.all([
          db.members.toArray(),
          db.sessions.toArray(),
          db.attendance.toArray(),
          db.songs.toArray(),
          db.setlists.toArray(),
          db.drills.toArray(),
          db.sets.toArray(),
          db.kemajuan.toArray(),
          db.memberNotes.toArray(),
          db.evaluasi.toArray(),
        ])
      if (!hidup) return
      setIdLokal({
        anggota: kunci(anggota),
        jadwal: kunci(jadwal),
        absensi: kunci(absensi),
        lagu: kunci(lagu),
        setlist: kunci(setlist),
        drill: kunci(drill),
        set: kunci(set),
        kemajuan: kunci(kemajuan),
        catatan: kunci(catatan),
        evaluasi: kunci(evaluasi),
      })
    })()
    return () => {
      hidup = false
    }
  }, [])

  const ringkas = ringkasDataPindah(hasil.data, idLokal ?? {})

  function lanjut() {
    if (hasil.teks == null) return
    titipBerkas({ jenis: 'data', nama: hasil.nama, teks: hasil.teks })
    onTutup()
    navigate('/data')
  }

  return (
    <div data-testid="buka-data">
      {idLokal == null ? (
        <p className="text-xs text-slate-500">Menghitung isi berkas…</p>
      ) : (
        <ul className="space-y-1">
          {ringkas.baris.map((b) => (
            <li
              key={b.label}
              className="flex items-center gap-2 rounded bg-slate-800/50 px-2 py-1.5 text-sm"
            >
              <span className="flex-1 text-slate-200">{b.label}</span>
              <span className="text-xs tabular-nums text-slate-400">{b.jumlah}</span>
              {b.baru > 0 && (
                <span className="text-xs tabular-nums text-emerald-400">{b.baru} baru</span>
              )}
              {b.ditimpa > 0 && (
                <span className="text-xs tabular-nums text-rose-300">{b.ditimpa} ditimpa</span>
              )}
            </li>
          ))}
          {ringkas.baris.length === 0 && (
            <li className="text-xs text-slate-500">Berkasnya tidak berisi data apa pun.</li>
          )}
        </ul>
      )}
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        Penerapannya di menu Data — di sana Anda bisa mencocokkan anggota dulu sebelum menekan
        Terapkan.
      </p>
      <div className="mt-3 flex justify-end">
        <Button variant="primary" data-testid="buka-lanjut-data" onClick={lanjut}>
          Buka di menu Data
        </Button>
      </div>
    </div>
  )
}

/** Show: pratinjau + impor langsung (timpa/gabung/salinan + cocok anggota). */
function TubuhShow({ hasil, onTutup }: { hasil: BerkasDikenal; onTutup: () => void }) {
  const navigate = useNavigate()
  const salah = cekBerkas(hasil.data)
  if (salah) {
    return (
      <div
        data-testid="buka-show-rusak"
        className="rounded-lg border border-rose-500/40 bg-rose-500/5 p-3 text-xs leading-relaxed text-slate-300"
      >
        <p className="font-semibold text-rose-300">Berkas show-nya tidak lengkap</p>
        <p className="mt-1">{salah}. Tidak ada yang diubah.</p>
      </div>
    )
  }
  return (
    <AlurImporShow
      data={hasil.data as BerkasShow}
      testId="buka-show"
      onSelesai={() => {
        onTutup()
        navigate('/drill')
      }}
    />
  )
}

/** Repertoar: pratinjau baru/ditimpa + terapkan langsung. */
function TubuhRepertoar({ hasil, onTutup }: { hasil: BerkasDikenal; onTutup: () => void }) {
  const toast = useToast()
  const [siap, setSiap] = useState<{
    paket: PaketRepertoar
    baru: { songs: number; setlists: number; drills: number }
    timpa: { songs: number; setlists: number; drills: number }
    rujukanHilang: number
    berbahaya: boolean
  } | null>(null)
  const [sedang, setSedang] = useState(false)

  useEffect(() => {
    let hidup = true
    ;(async () => {
      if (hasil.teks == null) return
      const baca = bacaPaket(hasil.teks)
      if (!baca.ok) return
      const [songs, setlists, drills] = await Promise.all([
        db.songs.toArray(),
        db.setlists.toArray(),
        db.drills.toArray(),
      ])
      if (!hidup) return
      const r = ringkasanImpor(baca.paket, { songs, setlists, drills })
      setSiap({
        paket: baca.paket,
        baru: {
          songs: r.baru.songs.length,
          setlists: r.baru.setlists.length,
          drills: r.baru.drills.length,
        },
        timpa: {
          songs: r.timpa.songs.length,
          setlists: r.timpa.setlists.length,
          drills: r.timpa.drills.length,
        },
        rujukanHilang: r.rujukanHilang.length,
        berbahaya: perluPeringatan(r),
      })
    })()
    return () => {
      hidup = false
    }
  }, [hasil.teks])

  async function terapkan() {
    if (!siap) return
    setSedang(true)
    try {
      await terapkanPaket(siap.paket)
      toast.push(`${siap.baru.songs} lagu masuk, ${siap.timpa.songs} ditimpa`)
      onTutup()
    } catch {
      toast.push('Gagal menerapkan repertoar', 'err')
    } finally {
      setSedang(false)
    }
  }

  if (hasil.teks == null) return null
  const baca = bacaPaket(hasil.teks)
  if (!baca.ok) {
    return (
      <div
        data-testid="buka-repertoar-rusak"
        className="rounded-lg border border-rose-500/40 bg-rose-500/5 p-3 text-xs text-slate-300"
      >
        {baca.alasan}. Tidak ada yang diubah.
      </div>
    )
  }
  const tim = baca.paket.team?.teamName
  return (
    <div data-testid="buka-repertoar">
      {tim && (
        <p className="mb-2 text-xs text-slate-400">
          Dari <span className="text-slate-200">{tim}</span>
        </p>
      )}
      {siap == null ? (
        <p className="text-xs text-slate-500">Menghitung isi paket…</p>
      ) : (
        <>
          <dl className="mb-3 grid grid-cols-3 gap-2 text-center">
            <RingkasanMini judul="Lagu" baru={siap.baru.songs} timpa={siap.timpa.songs} />
            <RingkasanMini judul="Set list" baru={siap.baru.setlists} timpa={siap.timpa.setlists} />
            <RingkasanMini judul="Drill" baru={siap.baru.drills} timpa={siap.timpa.drills} />
          </dl>
          {siap.berbahaya && (
            <p className="mb-3 rounded-lg border border-amber-600/40 bg-amber-600/10 px-3 py-2 text-xs text-amber-200">
              {siap.timpa.songs} lagu, {siap.timpa.setlists} set list, dan {siap.timpa.drills}{' '}
              drill yang sudah ada akan <strong>ditimpa</strong>. Suntingan lokal pada bagian itu
              akan hilang.
            </p>
          )}
          {siap.rujukanHilang > 0 && (
            <p className="mb-3 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-300">
              Ada {siap.rujukanHilang} lagu yang dirujuk paket ini tetapi tidak ikut dan tidak ada
              di perangkat ini. Impor tetap aman, tetapi bagian itu akan berlubang.
            </p>
          )}
        </>
      )}
      <div className="mt-3 flex justify-end">
        <Button
          variant={siap?.berbahaya ? 'danger' : 'primary'}
          data-testid="buka-repertoar-terapkan"
          disabled={siap == null || sedang}
          onClick={() => void terapkan()}
        >
          {sedang ? 'Menerapkan…' : 'Terapkan'}
        </Button>
      </div>
    </div>
  )
}

function RingkasanMini({ judul, baru, timpa }: { judul: string; baru: number; timpa: number }) {
  return (
    <div className="rounded-lg border border-slate-800 px-2 py-2">
      <dt className="text-[11px] text-slate-500">{judul}</dt>
      <dd className="text-sm text-slate-100">
        {baru > 0 && <span className="text-emerald-300">+{baru}</span>}
        {baru > 0 && timpa > 0 && <span className="text-slate-600"> / </span>}
        {timpa > 0 && <span className="text-amber-300">~{timpa}</span>}
        {baru === 0 && timpa === 0 && <span className="text-slate-600">—</span>}
      </dd>
    </div>
  )
}

/** Paket anggota (hanya sampai sini dalam mode anggota). */
function TubuhPaket({
  hasil,
  data,
  bitaZip,
  onTutup,
}: {
  hasil: BerkasDikenal
  data: Record<string, unknown>
  bitaZip?: Uint8Array
  onTutup: () => void
}) {
  const toast = useToast()
  const navigate = useNavigate()
  const [sedang, setSedang] = useState(false)
  const ringkas = ringkasPaket(data)
  if (!ringkas) return null

  async function buka() {
    setSedang(true)
    try {
      const h = await simpanPaketAnggota(data as unknown as Parameters<typeof simpanPaketAnggota>[0])
      if (bitaZip && (hasil.audioZip ?? 0) > 0) {
        await pulihkanAudioDariZipPaket(bitaZip)
      }
      if (h.penerima) {
        try {
          localStorage.setItem('drillkit.meId', h.penerima.id)
        } catch {
          // abaikan
        }
      }
      toast.push(
        h.penerima
          ? `Paket "${h.namaTim}" dibuka — hai, ${h.penerima.nama}!`
          : `Paket "${h.namaTim}" dibuka`,
      )
      onTutup()
      navigate('/berbagi')
    } catch {
      toast.push('Gagal membuka paket', 'err')
    } finally {
      setSedang(false)
    }
  }

  return (
    <div data-testid="buka-paket">
      <p className="mb-2 text-sm text-slate-300">
        Paket tim <b>{ringkas.tim}</b>
        {ringkas.penerima.jenis === 'anggota' ? (
          <>
            {' '}· untuk <b>{ringkas.penerima.nama}</b>
          </>
        ) : (
          ' · untuk semua anggota (grup)'
        )}
      </p>
      <ul className="space-y-1 text-xs text-slate-400">
        <li>
          {ringkas.jumlahAnggota} anggota · {ringkas.jumlahJadwal} jadwal · {ringkas.jumlahDrill}{' '}
          drill ({ringkas.jumlahSet} set) · {ringkas.jumlahLagu} lagu
        </li>
        {(ringkas.jumlahPartitur > 0 || (hasil.audioZip ?? 0) > 0) && (
          <li data-testid="buka-paket-partitur">
            {ringkas.jumlahPartitur > 0 && `${ringkas.jumlahPartitur} partitur siap baca`}
            {ringkas.jumlahPartitur > 0 && (hasil.audioZip ?? 0) > 0 && ' · '}
            {(hasil.audioZip ?? 0) > 0 && `${hasil.audioZip} rekaman panduan`}
          </li>
        )}
        {(ringkas.jumlahAbsensi > 0 || ringkas.jumlahCatatan > 0) && (
          <li>
            {ringkas.jumlahAbsensi} absensi · {ringkas.jumlahCatatan} catatan
          </li>
        )}
        {ringkas.terkunci > 0 && <li>{ringkas.terkunci} data terkunci (butuh kunci pribadi)</li>}
      </ul>
      {hasil.jenis === 'zip-anggota' && (
        <p className="mt-2 text-[11px] text-slate-500">
          Satu-satunya paket di dalam {hasil.nama} — langsung dibuka.
        </p>
      )}
      <div className="mt-3 flex justify-end">
        <Button
          variant="primary"
          data-testid="buka-paket-buka"
          disabled={sedang}
          onClick={() => void buka()}
        >
          {sedang ? 'Membuka…' : 'Buka paket'}
        </Button>
      </div>
    </div>
  )
}

/** CSV: pratinjau + teruskan ke halaman tujuannya. */
function TubuhCsv({ hasil, onTutup }: { hasil: BerkasDikenal; onTutup: () => void }) {
  const navigate = useNavigate()
  const ringkas = hasil.teks != null ? ringkasCsv(hasil.teks) : { baris: 0, kolom: [] as string[] }
  const tujuan = TUJUAN_JENIS[hasil.jenis]

  function lanjut() {
    if (hasil.teks == null) return
    titipBerkas({ jenis: hasil.jenis, nama: hasil.nama, teks: hasil.teks })
    onTutup()
    navigate(tujuan.rute)
  }

  return (
    <div data-testid="buka-csv">
      <p className="text-sm text-slate-300">
        <b>{ringkas.baris}</b> baris data
      </p>
      <p className="mt-1 break-all text-[11px] text-slate-500">
        Kolom: <code className="text-slate-400">{ringkas.kolom.join(', ')}</code>
      </p>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        Dibuka di <b>{tujuan.tempat}</b> — di sana isinya bisa diperiksa dulu sebelum diterapkan.
      </p>
      <div className="mt-3 flex justify-end">
        <Button variant="primary" data-testid="buka-lanjut-csv" onClick={lanjut}>
          Buka di {tujuan.tempat.split(' → ')[0]}
        </Button>
      </div>
    </div>
  )
}

function TubuhPartitur({ hasil }: { hasil: BerkasDikenal }) {
  const tujuan = TUJUAN_JENIS.partitur
  const r = hasil.partiturRingkas
  const baris: { label: string; nilai: string }[] = []
  if (r) {
    if (r.judul) baris.push({ label: 'Judul', nilai: r.judul })
    if (r.pengarang) baris.push({ label: 'Pengarang', nilai: r.pengarang })
    baris.push({ label: 'Birama', nilai: String(r.jumlahBirama) })
    baris.push({ label: 'Part', nilai: r.parts.map((p) => p.nama).join(', ') })
    if (r.sukat) {
      const perubahan = r.perubahanSukat
      const awal = `${r.sukat.beats}/${r.sukat.beatType}`
      baris.push({
        label: 'Sukat',
        nilai: perubahan.length > 1 ? `${awal} (berubah ${perubahan.length - 1}×)` : awal,
      })
    }
    if (r.tempo != null) baris.push({ label: 'Tempo', nilai: `${r.tempo} BPM` })
  }

  return (
    <div data-testid="buka-partitur">
      {r ? (
        <dl className="grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-1 text-[12px]">
          {baris.map((b) => (
            <Fragment key={b.label}>
              <dt className="text-slate-500">{b.label}</dt>
              <dd className="break-words text-slate-200">{b.nilai || '—'}</dd>
            </Fragment>
          ))}
        </dl>
      ) : (
        <p data-testid="buka-partitur-gagal" className="text-[12px] leading-relaxed text-amber-100/90">
          {hasil.partiturTipe === 'pdf' ? (
            <>Berkas PDF — isinya tidak bisa diringkas DrillKit, tetapi tetap bisa disimpan sebagai partitur lagu.</>
          ) : (
            <>
              Pemindai DrillKit tidak sanggup meringkas berkas ini, jadi judul &amp; biramanya belum terbaca.
              Berkasnya <b>tetap</b> bisa disimpan apa adanya.
              {hasil.partiturGagal && (
                <span className="mt-1 block text-slate-400">Sebabnya: {hasil.partiturGagal}</span>
              )}
            </>
          )}
        </p>
      )}
      <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
        Dipasang ke sebuah lagu di <b>{tujuan.tempat}</b> — di sana partitur bisa dipilih lagunya, lalu dibaca anggota.
      </p>
    </div>
  )
}
