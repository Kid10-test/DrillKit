import { useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { ArsipMusim } from '../../db/types'
import {
  hitungGeserHari,
  rencanaAmbilArsip,
  teksRencanaAmbil,
  type PilihanAmbil,
} from '../../lib/pindahMusim'
import { formatDateShort, sesiMeta, todayISO, uid } from '../../lib/utils'
import { Button, Field, Input, Modal, Toggle, useToast } from '../ui'

/**
 * v2.10 — Ambil materi & jadwal dari arsip musim, satu per satu.
 *
 * Kebalikan "Muat Ulang" (yang mengganti seluruh musim berjalan): di sini
 * pelatih mencentang lagu / drill / set list / sesi jadwal yang masih
 * dipakai, lalu butir itu **ditambahkan** ke musim berjalan. Tidak ada yang
 * ditimpa; aturan rujukannya ada di `rencanaAmbilArsip` (pindahMusim.ts).
 */
export function AmbilDariArsip({ arsip, onClose }: { arsip: ArsipMusim; onClose: () => void }) {
  const toast = useToast()
  const m = arsip.muatanMusim
  const [pilih, setPilih] = useState<PilihanAmbil>({ songIds: [], drillIds: [], setlistIds: [], sessionIds: [] })
  const [tanggalMulai, setTanggalMulai] = useState(todayISO())
  const [pertahankanHari, setPertahankanHari] = useState(true)
  const [menulis, setMenulis] = useState(false)

  const ruangKerja = useLiveQuery(
    async () => ({
      songIds: new Set((await db.songs.toCollection().primaryKeys()) as string[]),
      drillIds: new Set((await db.drills.toCollection().primaryKeys()) as string[]),
      setlistIds: new Set((await db.setlists.toCollection().primaryKeys()) as string[]),
    }),
    [],
  )

  const sesiUrut = useMemo(
    () => [...(m.sessions ?? [])].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    [m.sessions],
  )
  const awalTerpilih = useMemo(() => {
    const dipilih = new Set(pilih.sessionIds)
    return sesiUrut.find((s) => dipilih.has(s.id))?.date
  }, [sesiUrut, pilih.sessionIds])
  const geserHari = awalTerpilih ? hitungGeserHari(awalTerpilih, tanggalMulai, pertahankanHari) : 0

  const rencana = useMemo(() => {
    if (!ruangKerja) return null
    let n = 0
    return rencanaAmbilArsip(arsip, pilih, ruangKerja, { geserHari, buatId: (a) => `${a}pratinjau${n++}` })
  }, [arsip, pilih, ruangKerja, geserHari])

  function alih(kunci: keyof PilihanAmbil, id: string) {
    setPilih((p) => {
      const ada = p[kunci].includes(id)
      return { ...p, [kunci]: ada ? p[kunci].filter((x) => x !== id) : [...p[kunci], id] }
    })
  }
  function semua(kunci: keyof PilihanAmbil, ids: string[]) {
    setPilih((p) => ({ ...p, [kunci]: p[kunci].length === ids.length ? [] : ids }))
  }

  async function tambahkan() {
    if (!ruangKerja) return
    setMenulis(true)
    try {
      const r = rencanaAmbilArsip(arsip, pilih, ruangKerja, { geserHari, buatId: (a) => uid(a) })
      await db.transaction(
        'rw',
        [db.songs, db.drills, db.sets, db.setlists, db.countSheets, db.anotasiPartitur, db.sessions],
        async () => {
          if (r.songs.length) await db.songs.bulkAdd(r.songs)
          if (r.drills.length) await db.drills.bulkAdd(r.drills)
          if (r.sets.length) await db.sets.bulkPut(r.sets)
          if (r.setlists.length) await db.setlists.bulkAdd(r.setlists)
          if (r.countSheets.length) await db.countSheets.bulkPut(r.countSheets)
          if (r.anotasiPartitur.length) await db.anotasiPartitur.bulkPut(r.anotasiPartitur)
          if (r.sessions.length) await db.sessions.bulkAdd(r.sessions)
        },
      )
      toast.push(`Ditambahkan dari "${arsip.namaMusim}": ${teksRencanaAmbil(r)}`)
      onClose()
    } catch (err) {
      toast.push(err instanceof Error ? err.message : 'Gagal mengambil dari arsip', 'err')
    } finally {
      setMenulis(false)
    }
  }

  const adaPilihan =
    pilih.songIds.length + pilih.drillIds.length + pilih.setlistIds.length + pilih.sessionIds.length > 0

  return (
    <Modal
      open
      onClose={onClose}
      wide
      title={`Ambil dari arsip — ${arsip.namaMusim}`}
      testId="modal-ambil-arsip"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] text-slate-400" data-testid="ringkasan-ambil">
            {rencana ? `Akan ditambahkan: ${teksRencanaAmbil(rencana)}` : 'Memuat…'}
          </span>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              Batal
            </Button>
            <Button
              variant="primary"
              data-testid="tambahkan-dari-arsip"
              disabled={!adaPilihan || menulis || !rencana}
              onClick={() => void tambahkan()}
            >
              {menulis ? 'Menambahkan…' : 'Tambahkan ke musim berjalan'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4 text-xs text-slate-300">
        <p className="text-slate-400">
          Centang yang masih dipakai musim ini. Semuanya <strong>ditambahkan</strong>; tidak ada data musim berjalan yang ditimpa.
          Berkas partitur & rekaman lagu ikut tersambung lagi.
        </p>

        <Daftar
          judul="Lagu & partitur"
          testId="ambil-lagu"
          butir={(m.songs ?? []).map((s) => ({ id: s.id, label: s.title, info: `${s.bpm} BPM`, ada: ruangKerja?.songIds.has(s.id) }))}
          terpilih={pilih.songIds}
          onAlih={(id) => alih('songIds', id)}
          onSemua={(ids) => semua('songIds', ids)}
        />
        <Daftar
          judul="Drill & formasi"
          testId="ambil-drill"
          butir={(m.drills ?? []).map((d) => ({
            id: d.id,
            label: d.name,
            info: `${(m.sets ?? []).filter((x) => x.drillId === d.id).length} set`,
            ada: ruangKerja?.drillIds.has(d.id),
          }))}
          terpilih={pilih.drillIds}
          onAlih={(id) => alih('drillIds', id)}
          onSemua={(ids) => semua('drillIds', ids)}
        />
        <Daftar
          judul="Set list"
          testId="ambil-setlist"
          butir={(m.setlists ?? []).map((s) => ({
            id: s.id,
            label: s.name,
            info: `${(s.songIds ?? []).length} lagu`,
            ada: ruangKerja?.setlistIds.has(s.id),
          }))}
          terpilih={pilih.setlistIds}
          onAlih={(id) => alih('setlistIds', id)}
          onSemua={(ids) => semua('setlistIds', ids)}
        />

        <div className="space-y-2">
          <Daftar
            judul="Jadwal latihan"
            testId="ambil-jadwal"
            butir={sesiUrut.map((s) => ({
              id: s.id,
              label: `${formatDateShort(s.date)} · ${s.title}`,
              info: `${sesiMeta(s.type).label} · ${s.startTime}–${s.endTime}`,
            }))}
            terpilih={pilih.sessionIds}
            onAlih={(id) => alih('sessionIds', id)}
            onSemua={(ids) => semua('sessionIds', ids)}
          />
          {pilih.sessionIds.length > 0 && rencana && (
            <div className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900/50 p-3 sm:grid-cols-2">
              <Field label="Sesi pertama dimulai sekitar tanggal">
                <Input
                  type="date"
                  data-testid="ambil-tanggal-mulai"
                  value={tanggalMulai}
                  onChange={(e) => e.target.value && setTanggalMulai(e.target.value)}
                />
              </Field>
              <div className="space-y-1.5 pt-5">
                <Toggle
                  checked={pertahankanHari}
                  onChange={setPertahankanHari}
                  label="Pertahankan hari latihan (Selasa tetap Selasa)"
                  testId="ambil-pertahankan-hari"
                />
              </div>
              <div className="text-[11px] text-slate-400 sm:col-span-2" data-testid="pratinjau-tanggal-ambil">
                {rencana.sessions.length} sesi · pertama <strong>{formatDateShort(rencana.sessions[0].date)}</strong>
                {rencana.sessions.length > 1 && (
                  <>
                    {' '}
                    · terakhir <strong>{formatDateShort(rencana.sessions[rencana.sessions.length - 1].date)}</strong>
                  </>
                )}
                . Centang checklist dikosongkan; absensi & catatan pelaksanaan musim lalu tidak ikut.
              </div>
            </div>
          )}
        </div>

        {rencana && (rencana.laguIkut.length > 0 || rencana.sudahAda.length > 0 || rencana.rujukanDiputus.length > 0) && (
          <ul className="list-disc space-y-1 rounded-lg border border-amber-700/40 bg-amber-950/20 p-3 pl-6 text-[11px] text-amber-200" data-testid="catatan-ambil">
            {rencana.laguIkut.length > 0 && <li>Ikut terbawa karena dipakai drill / set list: {rencana.laguIkut.join(', ')}.</li>}
            {rencana.sudahAda.length > 0 && <li>Sudah ada di musim berjalan, dilewati: {rencana.sudahAda.join(', ')}.</li>}
            {rencana.rujukanDiputus.length > 0 && <li>Tautan dikosongkan karena tujuannya tidak ikut diambil: {rencana.rujukanDiputus.join('; ')}.</li>}
          </ul>
        )}
      </div>
    </Modal>
  )
}

function Daftar({
  judul,
  testId,
  butir,
  terpilih,
  onAlih,
  onSemua,
}: {
  judul: string
  testId: string
  butir: { id: string; label: string; info?: string; ada?: boolean }[]
  terpilih: string[]
  onAlih: (id: string) => void
  onSemua: (ids: string[]) => void
}) {
  const bisa = butir.filter((b) => !b.ada)
  return (
    <div data-testid={testId}>
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="font-semibold text-slate-200">
          {judul} <span className="font-normal text-slate-500">({butir.length})</span>
        </div>
        {bisa.length > 1 && (
          <button
            type="button"
            className="text-[11px] text-emerald-300 hover:underline"
            data-testid={`${testId}-semua`}
            onClick={() => onSemua(bisa.map((b) => b.id))}
          >
            {terpilih.length === bisa.length ? 'Kosongkan' : 'Pilih semua'}
          </button>
        )}
      </div>
      {butir.length === 0 ? (
        <div className="text-[11px] text-slate-500">Tidak ada di arsip ini.</div>
      ) : (
        <div className="max-h-48 space-y-0.5 overflow-y-auto rounded-lg border border-slate-800 p-1.5">
          {butir.map((b) => (
            <label
              key={b.id}
              className={`flex items-center gap-2 rounded px-1.5 py-1 ${b.ada ? 'opacity-50' : 'hover:bg-slate-800/60'}`}
            >
              <input
                type="checkbox"
                data-testid={`${testId}-${b.id}`}
                disabled={b.ada}
                checked={terpilih.includes(b.id)}
                onChange={() => onAlih(b.id)}
              />
              <span className="flex-1 truncate">{b.label}</span>
              <span className="shrink-0 text-[10px] text-slate-500">{b.ada ? 'sudah ada' : b.info}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}
