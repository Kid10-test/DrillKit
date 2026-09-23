/**
 * M4 — panel tukar repertoar antar perangkat.
 *
 * Komponen ini sengaja **memuat drill-nya sendiri**, jadi bisa dipasang di
 * dua tempat (halaman Musik dan halaman Berbagi) tanpa kedua halaman itu
 * harus tahu-menahu soal drill.
 *
 * Yang ditukar: lagu, set list, dan drill yang menaut ke lagu terpilih —
 * beserta set milik drill itu. Id lagu **tidak pernah diubah**, karena
 * `Drill.songId` dan `SetList.songIds` menyimpan id, bukan salinan lagu.
 */
import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { PaketRepertoar, SetList, Song } from '../db/types'
import {
  bacaPaket,
  bangunPaket,
  perluPeringatan,
  ringkasanImpor,
  terapkanPaket,
} from '../lib/repertoar'
import type { RingkasanImpor } from '../lib/repertoar'
import { downloadFile, readFileAsText, slugify } from '../lib/utils'
import { Button, Card, Modal, useToast } from './ui'

export function PanelTukarRepertoar({
  songs,
  setlists,
  team,
  ringkas = false,
}: {
  songs: Song[]
  setlists: SetList[]
  team?: PaketRepertoar['team']
  /** Tampilan ringkas untuk halaman Berbagi (tanpa judul kartu sendiri). */
  ringkas?: boolean
}) {
  const toast = useToast()
  const drills = useLiveQuery(() => db.drills.toArray(), [], [])
  // Nama tim dimuat sendiri supaya halaman yang memasang panel ini tidak
  // perlu repot mengurus pengaturan.
  const settings = useLiveQuery(() => db.settings.get('team'), [], undefined)
  const asal = team ?? (settings
    ? { teamName: settings.teamName, coachName: settings.coachName, city: settings.city }
    : undefined)

  const [bukaEkspor, setBukaEkspor] = useState(false)
  /** Id lagu yang dicentang. KOSONG berarti "semua lagu" — bukan "tidak ada". */
  const [pilih, setPilih] = useState<string[]>([])
  const [pratinjau, setPratinjau] = useState<{
    paket: PaketRepertoar
    ringkasan: RingkasanImpor
  } | null>(null)
  const [sedangTerapkan, setSedangTerapkan] = useState(false)
  const berkas = useRef<HTMLInputElement>(null)

  const semuaDipilih = pilih.length === 0
  const paketKini = useMemo(
    () =>
      bangunPaket({
        songs,
        setlists,
        drills: drills ?? [],
        sets: [],
        songIds: pilih,
        team: asal,
      }),
    [songs, setlists, drills, pilih, asal],
  )

  const balikPilih = (id: string) =>
    setPilih((v) => {
      // Beralih dari "semua" ke "pilih sendiri" harus terasa wajar: kalau
      // belum ada yang dipilih, centangan pertama berarti "hanya ini".
      const dasar = v.length === 0 ? songs.map((s) => s.id) : v
      const ada = dasar.includes(id)
      const next = ada ? dasar.filter((x) => x !== id) : [...dasar, id]
      // Kalau akhirnya semua tercentang, kembalikan ke "semua" (larik kosong).
      return next.length === songs.length ? [] : next
    })

  async function unduh() {
    // Set diambil hanya untuk drill yang ikut — percuma memuat semua set
    // kalau cuma beberapa drill yang berangkat.
    const idDrill = paketKini.drills.map((d) => d.id)
    const setsUntuk = idDrill.length
      ? await db.sets.where('drillId').anyOf(idDrill).toArray()
      : []
    const paket: PaketRepertoar = { ...paketKini, sets: setsUntuk }
    const nama = slugify(asal?.teamName ?? 'repertoar')
    downloadFile(
      `repertoar-${nama}-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(paket),
    )
    setBukaEkspor(false)
  }

  async function bukaBerkas(file: File) {
    const hasil = bacaPaket(await readFileAsText(file))
    if (!hasil.ok) {
      toast.push(hasil.alasan, 'err')
      return
    }
    setPratinjau({
      paket: hasil.paket,
      ringkasan: ringkasanImpor(hasil.paket, {
        songs,
        setlists,
        drills: drills ?? [],
      }),
    })
  }

  async function terapkan() {
    if (!pratinjau) return
    setSedangTerapkan(true)
    try {
      await terapkanPaket(pratinjau.paket)
      toast.push(
        `${pratinjau.ringkasan.baru.songs.length} lagu masuk, ` +
          `${pratinjau.ringkasan.timpa.songs.length} ditimpa`,
      )
      setPratinjau(null)
    } catch {
      toast.push('Gagal menerapkan repertoar', 'err')
    } finally {
      setSedangTerapkan(false)
    }
  }

  /* ------------------------------- Tampilan ------------------------------- */
  const tombol = (
    <div className="flex flex-wrap gap-2" data-testid="tukar-repertoar">
      <Button
        size="sm"
        data-testid="ekspor-repertoar"
        onClick={() => setBukaEkspor(true)}
        disabled={!songs.length}
        title="Unduh repertoar untuk dibuka di perangkat lain"
      >
        Ekspor repertoar
      </Button>
      <Button
        size="sm"
        variant="ghost"
        data-testid="impor-repertoar"
        onClick={() => berkas.current?.click()}
        title="Buka berkas repertoar dari perangkat lain"
      >
        Impor repertoar
      </Button>
      <input
        ref={berkas}
        data-testid="berkas-repertoar"
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) void bukaBerkas(f)
          e.target.value = ''
        }}
      />
    </div>
  )

  if (ringkas) return tombol

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold text-slate-200">Tukar repertoar</h2>
          <p className="text-[11px] text-slate-500">
            Pindahkan lagu, set list, dan drill yang menautkannya ke perangkat lain —
            tanpa server, lewat berkas.
          </p>
        </div>
      </div>
      {tombol}
      {!songs.length && (
        <p className="mt-2 text-[11px] text-slate-500">
          Belum ada lagu untuk diekspor. Tambahkan lagu ke repertoar dulu.
        </p>
      )}
      {ModalEkspor()}
      {ModalPratinjau()}
    </Card>
  )

  /* ------------------------------ Modal ekspor ---------------------------- */
  function ModalEkspor() {
    return (
      <Modal
        open={bukaEkspor}
        onClose={() => setBukaEkspor(false)}
        title="Ekspor repertoar"
        testId="modal-ekspor-repertoar"
        footer={
          <>
            <Button variant="ghost" onClick={() => setBukaEkspor(false)}>
              Batal
            </Button>
            <Button
              data-testid="unduh-repertoar"
              onClick={() => void unduh()}
              disabled={!paketKini.songs.length}
            >
              Unduh berkas
            </Button>
          </>
        }
      >
        <p className="mb-3 text-xs text-slate-400">
          Pilih lagu yang ingin dibawa. Set list dan drill yang menaut ke lagu
          itu ikut otomatis, beserta set milik drill tersebut.
        </p>
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            data-testid="pilih-semua-lagu"
            onClick={() => setPilih([])}
            className={
              'rounded-full border px-3 py-1 text-[11px] ' +
              (semuaDipilih
                ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-200'
                : 'border-slate-700 text-slate-400')
            }
          >
            Semua lagu
          </button>
          <span className="text-[11px] text-slate-500" data-testid="ringkasan-ekspor">
            {paketKini.songs.length} lagu · {paketKini.setlists.length} set list ·{' '}
            {paketKini.drills.length} drill
          </span>
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {songs.map((s) => (
            <label
              key={s.id}
              data-testid={`centang-lagu-${s.id}`}
              className="flex cursor-pointer items-center gap-2 rounded-lg border border-slate-800 px-3 py-2 hover:bg-slate-800/50"
            >
              <input
                type="checkbox"
                checked={semuaDipilih || pilih.includes(s.id)}
                onChange={() => balikPilih(s.id)}
                className="h-4 w-4 accent-emerald-500"
              />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-100">{s.title}</span>
                <span className="block text-[11px] text-slate-500">
                  {s.bpm} BPM
                  {s.tempoMap?.length ? ` · ${s.tempoMap.length} segmen tempo` : ''}
                </span>
              </span>
            </label>
          ))}
        </div>
      </Modal>
    )
  }

  /* ---------------------------- Modal pratinjau --------------------------- */
  function ModalPratinjau() {
    if (!pratinjau) return null
    const r = pratinjau.ringkasan
    const berbahaya = perluPeringatan(r)
    return (
      <Modal
        open
        onClose={() => setPratinjau(null)}
        title="Terapkan repertoar"
        testId="modal-pratinjau-repertoar"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPratinjau(null)}>
              Batal
            </Button>
            <Button
              data-testid="terapkan-repertoar"
              onClick={() => void terapkan()}
              disabled={sedangTerapkan}
              variant={berbahaya ? 'danger' : 'primary'}
            >
              {sedangTerapkan ? 'Menerapkan…' : 'Terapkan'}
            </Button>
          </>
        }
      >
        {pratinjau.paket.team?.teamName && (
          <p className="mb-3 text-xs text-slate-400">
            Dari <span className="text-slate-200">{pratinjau.paket.team.teamName}</span>
            {pratinjau.paket.team.coachName ? ` · ${pratinjau.paket.team.coachName}` : ''}
          </p>
        )}
        <dl className="mb-3 grid grid-cols-3 gap-2 text-center" data-testid="ringkasan-impor">
          <Ringkasan
            judul="Lagu"
            baru={r.baru.songs.length}
            timpa={r.timpa.songs.length}
          />
          <Ringkasan
            judul="Set list"
            baru={r.baru.setlists.length}
            timpa={r.timpa.setlists.length}
          />
          <Ringkasan
            judul="Drill"
            baru={r.baru.drills.length}
            timpa={r.timpa.drills.length}
          />
        </dl>
        {berbahaya && (
          <p
            className="mb-3 rounded-lg border border-amber-600/40 bg-amber-600/10 px-3 py-2 text-xs text-amber-200"
            data-testid="peringatan-timpa"
          >
            {r.timpa.songs.length} lagu, {r.timpa.setlists.length} set list, dan{' '}
            {r.timpa.drills.length} drill yang sudah ada di perangkat ini akan{' '}
            <strong>ditimpa</strong> isinya. Suntingan lokal pada bagian itu akan hilang.
          </p>
        )}
        {r.rujukanHilang.length > 0 && (
          <p
            className="rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs text-slate-300"
            data-testid="peringatan-rujukan"
          >
            Ada {r.rujukanHilang.length} lagu yang dirujuk set list atau drill dalam
            berkas ini, tetapi lagunya tidak ikut dan tidak ada di perangkat ini.
            Impor tetap aman, tetapi bagian itu akan berlubang sampai lagunya
            ditambahkan.
          </p>
        )}
      </Modal>
    )
  }
}

function Ringkasan({
  judul,
  baru,
  timpa,
}: {
  judul: string
  baru: number
  timpa: number
}) {
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
