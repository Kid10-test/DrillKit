/**
 * #34a — membaca semua data yang menjadi bukti gerbang musim, sekali saja,
 * dan hanya bila memang ada musim TC (supaya Dashboard tetap ringan).
 */
import { useMemo } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type { MusimTc } from '../../db/types'
import { ringkasMusim, type DataBuktiMusim, type RingkasMusim } from '../../lib/manajemenMusim'
import { todayISO } from '../../lib/utils'

export function useRingkasMusim(daftar: MusimTc[] | undefined): { ringkas: RingkasMusim[]; data: DataBuktiMusim | null } {
  const ada = (daftar ?? []).length > 0
  const data = useLiveQuery(
    async (): Promise<DataBuktiMusim | null> => {
      if (!ada) return null
      const [songs, setlists, sessions, drills, sets, members, kemajuan, penilaian, inventaris, manifes] = await Promise.all([
        db.songs.toArray(),
        db.setlists.toArray(),
        db.sessions.toArray(),
        db.drills.toArray(),
        db.sets.toArray(),
        db.members.toArray(),
        db.kemajuan.toArray(),
        db.penilaianLomba.toArray(),
        db.inventaris.toArray(),
        db.logistikLomba.toArray(),
      ])
      return { songs, setlists, sessions, drills, sets, members, kemajuan, penilaian, inventaris, manifes, hariIni: todayISO() }
    },
    [ada],
    null,
  )
  const ringkas = useMemo(() => (data ? (daftar ?? []).map((m) => ringkasMusim(m, data)) : []), [daftar, data])
  return { ringkas, data }
}
