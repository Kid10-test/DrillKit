/**
 * Diekstrak dari `src/pages/Drill.tsx` (#5 — pecah Drill.tsx).
 * Isinya tidak diubah; hanya alamat impor yang disesuaikan.
 */

/** Halaman Drill — pilih drill, lalu serahkan ke editor. */
import { useEffect, useMemo, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type {
  Drill,
  DrillPoint,
  DrillSet,
} from '../db/types'
import {
  Button,
  ConfirmButton,
  EmptyState,
  PageHeader,
  Select,
  useToast,
} from '../components/ui'
import { RiwayatDrill } from '../components/RiwayatDrill'
import { foto } from '../lib/riwayat'
import {
  IconGrid,
  IconPlus,
} from '../components/Icons'

import { hapusKemajuan } from '../lib/kemajuan'
import { salinCountSheetUntukDrillBaru } from '../lib/countSheet'
import {
  uid,
} from '../lib/utils'
import { useSettings } from '../hooks/useSettings'
import { Editor } from '../components/DrillEditor'

export default function DrillPage() {
  const toast = useToast()
  const settings = useSettings()
  const drills = useLiveQuery(() => db.drills.orderBy('updatedAt').toArray(), [], [])
  const members = useLiveQuery(() => db.members.toArray(), [], [])

  const [drillId, setDrillId] = useState<string>('')
  /** 1a — panel riwayat formasi. */
  const [bukaRiwayat, setBukaRiwayat] = useState(false)

  // Pilih drill terakhir yang diedit saat data pertama kali muncul.
  useEffect(() => {
    if (drillId || !drills?.length) return
    setDrillId(drills[drills.length - 1].id)
  }, [drills, drillId])

  const drill = drills?.find((d) => d.id === drillId)

  const sets = useLiveQuery(
    async (): Promise<DrillSet[]> => (drillId ? db.sets.where('drillId').equals(drillId).toArray() : []),
    [drillId],
    [] as DrillSet[],
  )
  const orderedSets = useMemo(() => [...sets].sort((a, b) => a.order - b.order), [sets])

  async function createDrill() {
    if (!settings) return
    const d: Drill = {
      id: uid('d_'),
      name: `Drill baru ${(drills?.length ?? 0) + 1}`,
      showTitle: '',
      field: { ...settings.defaultField },
      tempo: 120,
      beatsPerCount: 1,
      rosterIds: (members ?? []).filter((m) => m.active).map((m) => m.id),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    await db.drills.put(d)
    // Set pertama langsung berisi semua anggota dalam formasi blok.
    const pts: Record<string, DrillPoint> = {}
    const roster = (members ?? []).filter((m) => m.active)
    const cols = Math.ceil(Math.sqrt(roster.length))
    roster.forEach((m, i) => {
      const c = i % cols
      const r = Math.floor(i / cols)
      pts[m.id] = { x: (c - (cols - 1) / 2) * 5, y: -15 + r * 5, facing: 'front' }
    })
    await db.sets.put({
      id: uid('set_'),
      drillId: d.id,
      order: 0,
      name: 'Set 1',
      counts: 16,
      points: pts,
      createdAt: Date.now(),
    })
    setDrillId(d.id)
    toast.push('Drill baru dibuat')
  }

  async function duplicateDrill(d: Drill) {
    const newId = uid('d_')
    const old = await db.sets.where('drillId').equals(d.id).toArray()
    const petaIdSet: Record<string, string> = {}
    const setsBaru = old.map((s) => {
      const idBaru = uid('set_')
      petaIdSet[s.id] = idBaru
      return { ...s, id: idBaru, drillId: newId }
    })
    const markersBaru = d.markers?.map((m) => {
      if (!m.perSet) return { ...m }
      const perSetBaru: NonNullable<typeof m.perSet> = {}
      for (const [idLama, kf] of Object.entries(m.perSet)) {
        if (petaIdSet[idLama]) perSetBaru[petaIdSet[idLama]] = { ...kf }
      }
      return { ...m, perSet: Object.keys(perSetBaru).length ? perSetBaru : undefined }
    })
    await db.drills.put({
      ...d,
      id: newId,
      name: `${d.name} (salinan)`,
      markers: markersBaru,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    await db.sets.bulkPut(setsBaru)
    const csLama = await db.countSheets.where('drillId').equals(d.id).toArray()
    if (csLama.length) {
      await db.countSheets.bulkPut(salinCountSheetUntukDrillBaru(csLama, newId, petaIdSet))
    }
    setDrillId(newId)
    toast.push('Drill disalin')
  }

  async function removeDrill(d: Drill) {
    // 1a — difoto lebih dulu, dan fotonya SENGAJA tidak ikut dihapus:
    // inilah satu-satunya jejak drill yang terlanjur hilang. Menumpuknya
    // perlahan dan dibatasi pemangkasan per drill, jadi tidak meledak.
    await foto(d.id, 'sebelum-hapus-drill')
    await db.drills.delete(d.id)
    const ids = await db.sets.where('drillId').equals(d.id).primaryKeys()
    await db.sets.bulkDelete(ids)
    const csIds = await db.countSheets.where('drillId').equals(d.id).primaryKeys()
    if (csIds.length) await db.countSheets.bulkDelete(csIds)
    // K3 — kemajuan latihan ikut lenyap; kalau tidak, ia jadi yatim selamanya.
    await hapusKemajuan(d.id)
    setDrillId('')
    toast.push('Drill dihapus', 'info')
  }

  if (!drills) return null

  if (!drill) {
    return (
      <div>
        <PageHeader title="Drill & Formasi" subtitle="Rancang formasi, hitung langkah, lalu bagikan ke anggota" />
        <EmptyState
          icon={<IconGrid size={34} />}
          title="Belum ada drill"
          desc="Satu drill = satu show/penampilan. Di dalamnya bisa ada banyak set formasi yang saling berhubungan."
          action={
            <Button variant="primary" onClick={createDrill}>
              <IconPlus size={16} /> Buat drill
            </Button>
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title="Drill & Formasi"
        subtitle={drill.showTitle ? `${drill.name} — ${drill.showTitle}` : drill.name}
        actions={
          <>
            <Select value={drillId} onChange={(e) => setDrillId(e.target.value)} className="w-40 sm:w-52">
              {drills.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </Select>
            <Button onClick={createDrill}>
              <IconPlus size={16} /> Baru
            </Button>
            <Button onClick={() => duplicateDrill(drill)}>
              Salin
            </Button>
            <Button variant="ghost" size="md" onClick={() => setBukaRiwayat(true)}>
              Riwayat
            </Button>
            <ConfirmButton size="md" label="Hapus" message="Hapus drill ini?" onConfirm={() => removeDrill(drill)} />
          </>
        }
      />

      <Editor
        key={drill.id}
        drill={drill}
        sets={orderedSets}
        members={(members ?? []).filter((m) => m.active)}
        onGantiDrill={setDrillId}
      />

      {/* 1a — riwayat formasi. Sengaja dipasang di tingkat halaman, bukan
          di dalam editor: panel ini hanya perlu id drill, dan dengan begini
          ia tidak ikut digambar ulang setiap kali titik digeser. */}
      <RiwayatDrill
        drillId={drill.id}
        open={bukaRiwayat}
        onClose={() => setBukaRiwayat(false)}
      />
    </div>
  )
}
