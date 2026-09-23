import Dexie, { type Table } from 'dexie'
import { DEFAULT_SECTIONS } from '../lib/utils'
import type {
  AttendanceRecord,
  Drill,
  DrillSet,
  Evaluasi,
  Member,
  MemberNote,
  Session,
  ShareBundle,
  SetList,
  Song,
  Kemajuan,
  TeamSettings,
} from './types'

/**
 * Database lokal (IndexedDB).
 *
 * Kenapa IndexedDB? Karena aplikasi harus tetap berguna di lapangan yang
 * belum tentu ada sinyal, dan tidak ada biaya server sama sekali.
 */
export class DrillKitDB extends Dexie {
  members!: Table<Member, string>
  sessions!: Table<Session, string>
  attendance!: Table<AttendanceRecord, string>
  drills!: Table<Drill, string>
  sets!: Table<DrillSet, string>
  songs!: Table<Song, string>
  settings!: Table<TeamSettings, 'team'>
  /** Paket tim yang diimpor oleh perangkat anggota (mode anggota). */
  packages!: Table<{ key: string; data: ShareBundle; importedAt: number }, string>
  /** Catatan evaluasi pribadi per anggota (dibaca anggota di mode anggota). */
  memberNotes!: Table<MemberNote, string>
  /** M3 — set list: urutan lagu untuk satu penampilan. */
  setlists!: Table<SetList, string>
  /** K3 — kemajuan latihan per drill. Kuncinya id drill. */
  kemajuan!: Table<Kemajuan, string>
  /** H2 — evaluasi anggota dari pelatih. */
  evaluasi!: Table<Evaluasi, string>

  constructor() {
    super('drillkit')
    this.version(1).stores({
      members: 'id, name, section, active, code',
      sessions: 'id, date, type',
      attendance: 'id, sessionId, memberId, [sessionId+memberId]',
      drills: 'id, name, updatedAt',
      sets: 'id, drillId, order, [drillId+order]',
      songs: 'id, title',
      settings: 'key',
    })
    this.version(2).stores({
      packages: 'key',
    })
    this.version(3).stores({
      memberNotes: 'id, memberId, at',
    })
    this.version(4).stores({
      setlists: 'id, name, updatedAt',
    })
    this.version(5).stores({
      kemajuan: 'key',
    })
    this.version(6).stores({
      evaluasi: 'id, memberId, tanggal',
    })
  }
}

export const db = new DrillKitDB()

/* ------------------------------ Helpers ---------------------------------- */

export function defaultSettings(): TeamSettings {
  return {
    key: 'team',
    teamName: 'Marching Band Saya',
    coachName: 'Pelatih',
    memberMode: 0,
    defaultField: DEFAULT_FIELD,
    sections: DEFAULT_SECTIONS,
    backupIntervalDays: 7,
  }
}

/**
 * Hanya MEMBACA pengaturan.
 *
 * Penting: fungsi ini dipakai di dalam `useLiveQuery`, yang berjalan di
 * dalam transaksi read-only. Menulis (put/add) di dalamnya akan memicu
 * ReadOnlyError, jadi pembuatan data bawaan dilakukan di `ensureSettings()`.
 */
export async function getSettings(): Promise<TeamSettings | undefined> {
  return db.settings.get('team')
}

/** Membuat pengaturan bawaan kalau belum ada. Dipanggil sekali saat aplikasi mulai. */
export async function ensureSettings(): Promise<TeamSettings> {
  const s = await db.settings.get('team')
  if (s) return s
  const fresh = defaultSettings()
  await db.settings.put(fresh)
  return fresh
}

export async function saveSettings(patch: Partial<TeamSettings>) {
  const cur = (await db.settings.get('team')) ?? defaultSettings()
  await db.settings.put({ ...cur, ...patch, key: 'team' })
}

export const DEFAULT_FIELD = {
  widthYd: 53.33,
  lengthYd: 100,
  endZoneYd: 10,
  hash: 'ncaa' as const,
  gridYd: 5,
  step: '8to5' as const,
  customStepYd: 0.625,
  showLabels: 1,
}
