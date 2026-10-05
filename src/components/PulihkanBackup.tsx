/**
 * #7 — alur pulihkan backup dengan pratinjau (dipakai dua pintu).
 *
 * Dua cacat yang diperbaiki di sini:
 *
 * 1. Pulihkan backup di Pengaturan **langsung menulis tanpa pratinjau**.
 *    Kini selalu ada pratinjau dulu: tanggal backup, isi per tabel, dan
 *    berapa yang baru vs yang akan ditimpa.
 * 2. Pulihkan backup **menerima paket anggota** (`drillkit-share`), sehingga
 *    isi paket bisa tercampur ke data pelatih. Kini paket ditolak dengan
 *    jelas — penolakannya di tiap pintu masuk (`Settings.importBackup` dan
 *    modal pratinjau pintu baru), dan komponen ini hanya menerima muatan
 *    `drillkit-backup`.
 */
import { useEffect, useMemo, useState } from 'react'
import { db } from '../db/db'
import type { Member } from '../db/types'
import { ringkasBackup } from '../lib/bukaBerkas'
import { bukaZip } from '../lib/zip'
import {
  keputusanAwal,
  perluDitanya,
  saringBentrokLokal,
  susunSaran,
  terapkanCocok,
  tulisUlangMuatan,
  type KeputusanCocok,
  type SaranBaris,
} from '../lib/namaAnggota'
import { Button, useToast } from './ui'
import { PanelCocok } from './PanelCocok'

export interface AudioPulih {
  songId: string
  namaFile: string
  blob: Blob
  durasi?: number
  hash?: string
}

/**
 * Ekstrak rekaman audio biner dari ZIP backup (#6).
 *
 * Dipakai Pengaturan (jalur lamanya) dan pintu baru — dulunya logika ini
 * hanya ada di `Settings.importBackup`. Manifest dibaca bila ada; bila
 * tidak, id lagu ditebak dari nama berkas (`<songId>_<nama>`).
 */
export function ekstrakAudioZip(bita: Uint8Array): AudioPulih[] {
  const hasil: AudioPulih[] = []
  let entri: { nama: string; bita: Uint8Array; teks: () => string }[]
  try {
    entri = bukaZip(bita)
  } catch {
    return hasil
  }
  let manifest: Record<string, { songId: string; namaFile: string; durasi: number; hash: string }> = {}
  const entriManifest = entri.find((z) => z.nama === 'audio/manifest.json')
  if (entriManifest) {
    try {
      manifest = JSON.parse(entriManifest.teks())
    } catch {
      // abaikan — nama berkas masih bisa ditebak di bawah
    }
  }
  for (const z of entri) {
    if (!z.nama.startsWith('audio/') || z.nama.endsWith('.json')) continue
    const m = manifest[z.nama]
    let songId = m?.songId
    let namaFile = m?.namaFile
    if (!songId) {
      const dasar = z.nama.replace(/^audio\//, '')
      const garis = dasar.indexOf('_')
      if (garis > 0) {
        songId = dasar.substring(0, garis)
        namaFile = dasar.substring(garis + 1)
      }
    }
    if (songId && namaFile) {
      hasil.push({
        songId,
        namaFile,
        blob: new Blob([new Uint8Array(z.bita)], { type: 'audio/mpeg' }),
        durasi: m?.durasi,
        hash: m?.hash,
      })
    }
  }
  return hasil
}

/**
 * Tulis muatan backup ke database (dipindah utuh dari `Settings.tulisBackup`).
 *
 * Semantiknya **gabung** (`bulkPut` per tabel), bukan ganti total: yang ada
 * di berkas menimpa yang sama id-nya, yang lain dibiarkan. Tabel yang tidak
 * disebut berkas tidak disentuh sama sekali.
 */
export async function tulisMuatanBackup(
  data: Record<string, any>,
  anggotaLokal: Member[],
  kep: Record<string, KeputusanCocok>,
  audio?: AudioPulih[],
): Promise<{ bentrok: number; audio: number }> {
  const masuk = Array.isArray(data.members) ? (data.members as Member[]) : []
  const hasil = terapkanCocok({
    masuk,
    lokal: anggotaLokal,
    keputusan: kep,
    arah: 'lokal',
    timpaSamaId: true,
  })
  const { data: diubah, bentrok } = tulisUlangMuatan(data, hasil.peta)
  if (masuk.length) diubah.members = hasil.anggotaTulis
  if (Array.isArray(diubah.attendance)) {
    const saring = saringBentrokLokal(diubah.attendance, await db.attendance.toArray())
    diubah.attendance = saring.tulis
    bentrok.push(...saring.bentrok)
  }
  // Setiap tabel yang ditulis di bawah WAJIB tercantum di cakupan ini.
  // Dexie menolak tabel di luar cakupan (NotFound) dan seluruh pemulihan
  // batal. `memberNotes` dulu tertinggal, sehingga backup yang memuat
  // catatan anggota tidak bisa dipulihkan sama sekali (2a).
  await db.transaction(
    'rw',
    [
      db.members,
      db.sessions,
      db.attendance,
      db.drills,
      db.sets,
      db.songs,
      db.setlists,
      db.settings,
      db.memberNotes,
      db.kemajuan,
      db.evaluasi,
    ],
    async () => {
      if (diubah.members?.length) await db.members.bulkPut(diubah.members)
      if (diubah.sessions?.length) await db.sessions.bulkPut(diubah.sessions)
      if (diubah.attendance?.length) await db.attendance.bulkPut(diubah.attendance)
      if (diubah.drills?.length) await db.drills.bulkPut(diubah.drills)
      if (diubah.sets?.length) await db.sets.bulkPut(diubah.sets)
      if (diubah.songs?.length) await db.songs.bulkPut(diubah.songs)
      if (diubah.setlists?.length) await db.setlists.bulkPut(diubah.setlists)
      if (diubah.memberNotes?.length) await db.memberNotes.bulkPut(diubah.memberNotes)
      if (diubah.kemajuan?.length) await db.kemajuan.bulkPut(diubah.kemajuan)
      if (diubah.evaluasi?.length) await db.evaluasi.bulkPut(diubah.evaluasi)
    },
  )
  if (diubah.settings) await db.settings.put({ ...diubah.settings, key: 'team' })

  // #6 — pulihkan rekaman audio biner dari ZIP bila ada.
  let jmlAudio = 0
  if (audio && audio.length > 0) {
    for (const a of audio) {
      await db.rekamanAudio.put({
        id: a.songId,
        songId: a.songId,
        blob: a.blob,
        namaFile: a.namaFile,
        tipe: a.blob.type || 'audio/mpeg',
        ukuran: a.blob.size,
        durasi: a.durasi || 0,
        hash: a.hash || '',
        updatedAt: Date.now(),
      })
      jmlAudio += 1
    }
  }
  return { bentrok: bentrok.length, audio: jmlAudio }
}

/**
 * Isi modal pulihkan: pratinjau → (cocok anggota bila perlu) → pulihkan.
 *
 * Dibungkus modal oleh pemanggilnya (Pengaturan membungkus sendiri,
 * pintu baru membungkus lewat modal pratinjau) supaya judul & testid-nya
 * bisa mengikuti tempatnya.
 */
export function AlurPulihkanBackup({
  data,
  audio = [],
  namaBerkas,
  onSelesai,
  testId = 'pulih-backup',
}: {
  data: Record<string, any>
  audio?: AudioPulih[]
  namaBerkas?: string
  onSelesai?: () => void
  testId?: string
}) {
  const toast = useToast()
  const [idLokal, setIdLokal] = useState<Record<string, string[]> | null>(null)
  const [langkah, setLangkah] = useState<'pratinjau' | 'cocok'>('pratinjau')
  const [saran, setSaran] = useState<SaranBaris[]>([])
  const [keputusan, setKeputusan] = useState<Record<string, KeputusanCocok>>({})
  const [lokal, setLokal] = useState<Member[]>([])
  const [sedang, setSedang] = useState(false)

  useEffect(() => {
    let hidup = true
    ;(async () => {
      const kunci = (daftar: { id?: string; key?: string }[]) =>
        daftar.map((e) => e?.id ?? e?.key ?? '').filter(Boolean)
      const [members, sessions, attendance, songs, setlists, drills, sets, memberNotes, kemajuan, evaluasi] =
        await Promise.all([
          db.members.toArray(),
          db.sessions.toArray(),
          db.attendance.toArray(),
          db.songs.toArray(),
          db.setlists.toArray(),
          db.drills.toArray(),
          db.sets.toArray(),
          db.memberNotes.toArray(),
          db.kemajuan.toArray(),
          db.evaluasi.toArray(),
        ])
      if (!hidup) return
      setLokal(members)
      setIdLokal({
        members: kunci(members),
        sessions: kunci(sessions),
        attendance: kunci(attendance),
        songs: kunci(songs),
        setlists: kunci(setlists),
        drills: kunci(drills),
        sets: kunci(sets),
        memberNotes: kunci(memberNotes),
        kemajuan: kunci(kemajuan),
        evaluasi: kunci(evaluasi),
      })
      const baris = susunSaran(Array.isArray(data.members) ? data.members : [], members)
      setSaran(baris)
      setKeputusan(keputusanAwal(baris))
    })()
    return () => {
      hidup = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const ringkas = useMemo(() => ringkasBackup(data, idLokal ?? {}), [data, idLokal])
  const tim = (data.settings as { teamName?: unknown } | undefined)?.teamName
  const tanggal =
    typeof data.exportedAt === 'number'
      ? new Date(data.exportedAt).toLocaleDateString('id-ID', {
          day: 'numeric',
          month: 'long',
          year: 'numeric',
        })
      : '—'

  async function lanjut() {
    if (perluDitanya(saran, lokal.length) && langkah === 'pratinjau') {
      setLangkah('cocok')
      return
    }
    setSedang(true)
    try {
      const h = await tulisMuatanBackup(data, lokal, keputusan, audio)
      const infoAudio = h.audio > 0 ? ` (+ ${h.audio} rekaman audio)` : ''
      toast.push(
        h.bentrok
          ? `Backup dipulihkan · ${h.bentrok} bentrok dilaporkan${infoAudio}`
          : `Backup dipulihkan${infoAudio}`,
      )
      onSelesai?.()
    } catch {
      toast.push('Gagal memulihkan backup', 'err')
    } finally {
      setSedang(false)
    }
  }

  return (
    <div data-testid={testId}>
      <p className="mb-1 text-sm text-slate-300">
        Backup {typeof tim === 'string' && tim ? <b>{tim}</b> : 'tim'} · dibuat {tanggal}
        {namaBerkas ? (
          <>
            {' '}· <span className="text-slate-500">{namaBerkas}</span>
          </>
        ) : null}
      </p>
      <p className="mb-3 text-[11px] leading-relaxed text-slate-500">
        Memulihkan berarti <b>menggabungkan</b>: yang sama id-nya ditimpa, sisanya ditambahkan.
        Tidak ada data yang dihapus.
        {audio.length > 0 && (
          <>
            {' '}Termasuk <b>{audio.length} rekaman audio</b> dari ZIP.
          </>
        )}
      </p>
      {idLokal == null ? (
        <p className="text-xs text-slate-500">Menghitung isi backup…</p>
      ) : (
        <ul className="space-y-1" data-testid={`${testId}-isi`}>
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
            <li className="text-xs text-slate-500">Backup ini tidak berisi data apa pun.</li>
          )}
        </ul>
      )}
      {ringkas.adaPengaturan && (
        <p className="mt-2 text-[11px] text-slate-500">
          Pengaturan tim (nama, lapangan bawaan, section) ikut dipulihkan.
        </p>
      )}
      {langkah === 'cocok' && (
        <div className="mt-3">
          <PanelCocok
            saran={saran}
            lokal={lokal}
            keputusan={keputusan}
            onUbah={(id, kep) => setKeputusan((s) => ({ ...s, [id]: kep }))}
            pengantar="Backup ini memuat anggota yang belum ada di perangkat ini. Cocokkan dulu, atau biarkan sebagai anggota baru."
          />
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        {langkah === 'cocok' && (
          <Button variant="ghost" onClick={() => setLangkah('pratinjau')}>
            Kembali
          </Button>
        )}
        <Button
          variant="primary"
          data-testid={`${testId}-tombol`}
          disabled={sedang || idLokal == null}
          onClick={() => void lanjut()}
        >
          {sedang ? 'Memulihkan…' : langkah === 'cocok' ? 'Pulihkan sekarang' : 'Lanjut'}
        </Button>
      </div>
    </div>
  )
}
