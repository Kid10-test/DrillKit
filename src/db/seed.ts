import { db, DEFAULT_FIELD } from './db'
import type { DrillPoint, DrillSet, Member, Section, Session } from './types'
import { toISODate, uid } from '../lib/utils'

/**
 * Data contoh supaya aplikasi langsung bisa dicoba saat pertama dibuka.
 * Aman dihapus kapan saja lewat menu Pengaturan → "Kosongkan data".
 */

interface SeedMember {
  name: string
  section: Section
  instrument: string
  role?: Member['role']
}

const ROSTER: SeedMember[] = [
  { name: 'Andra Pratama', section: 'brass', instrument: 'Trumpet', role: 'sectionLeader' },
  { name: 'Bunga Lestari', section: 'brass', instrument: 'Mellophone' },
  { name: 'Citra Dewi', section: 'brass', instrument: 'Trombone' },
  { name: 'Dimas Saputra', section: 'brass', instrument: 'Baritone' },
  { name: 'Eka Wulandari', section: 'brass', instrument: 'Tuba' },
  { name: 'Fajar Nugroho', section: 'woodwind', instrument: 'Flute', role: 'sectionLeader' },
  { name: 'Gita Permata', section: 'woodwind', instrument: 'Clarinet' },
  { name: 'Hendra Wijaya', section: 'woodwind', instrument: 'Alto Sax' },
  { name: 'Indah Kirana', section: 'woodwind', instrument: 'Tenor Sax' },
  { name: 'Joko Susilo', section: 'percussion', instrument: 'Snare', role: 'sectionLeader' },
  { name: 'Kirana Ayu', section: 'percussion', instrument: 'Quad' },
  { name: 'Lukman Hakim', section: 'percussion', instrument: 'Bass Drum' },
  { name: 'Maya Anggraini', section: 'pit', instrument: 'Marimba' },
  { name: 'Naufal Ibrahim', section: 'pit', instrument: 'Xylophone' },
  { name: 'Putri Ramadhani', section: 'guard', instrument: 'Flag', role: 'sectionLeader' },
  { name: 'Rendra Kusuma', section: 'guard', instrument: 'Rifle' },
  { name: 'Sari Wahyuni', section: 'guard', instrument: 'Flag' },
  { name: 'Taufik Hidayat', section: 'guard', instrument: 'Sabre', role: 'drumMajor' },
]

export async function seedDemoData(): Promise<number> {
  const existing = await db.members.count()
  if (existing > 0) return 0

  const members: Member[] = ROSTER.map((m, i) => ({
    id: uid('m_'),
    code: `${m.section.slice(0, 2).toUpperCase()}${String(i + 1).padStart(2, '0')}`,
    name: m.name,
    section: m.section,
    instrument: m.instrument,
    role: m.role ?? 'member',
    joinYear: 2025,
    active: 1,
    token: uid('t_'),
    createdAt: Date.now(),
  }))
  await db.members.bulkPut(members)

  // Jadwal: dua yang sudah lewat (untuk contoh rekap absensi), tiga mendatang.
  const mk = (offsetDays: number, title: string, type: Session['type'], start: string, end: string): Session => {
    const d = new Date()
    d.setDate(d.getDate() + offsetDays)
    return {
      id: uid('s_'),
      title,
      type,
      date: toISODate(d),
      startTime: start,
      endTime: end,
      place: 'Lapangan Sekolah',
      notes: '',
      checklist: [
        { id: uid('c_'), text: 'Pemanasan & stretching', done: 0 },
        { id: uid('c_'), text: 'Latihan langkah dasar (8-to-5)', done: 0 },
        { id: uid('c_'), text: 'Drill bagian pembuka', done: 0 },
      ],
      createdAt: Date.now(),
    }
  }

  const sessions = [
    mk(-7, 'Latihan Rutin — Blok Pembuka', 'latihan', '15:30', '18:00'),
    mk(-3, 'Latihan Section', 'latihan', '15:30', '17:30'),
    mk(0, 'Latihan Rutin — Perapian Formasi', 'latihan', '15:30', '18:00'),
    mk(3, 'Latihan Gabungan', 'latihan', '13:00', '17:00'),
    mk(10, 'Penampilan — Hari Ulang Tahun Sekolah', 'penampilan', '08:00', '12:00'),
  ]
  await db.sessions.bulkPut(sessions)

  // Absensi contoh untuk dua sesi yang sudah lewat (acak tapi realistis).
  const records = []
  for (const s of sessions.slice(0, 2)) {
    for (const m of members) {
      const r = Math.random()
      const status = r < 0.82 ? 'hadir' : r < 0.9 ? 'izin' : r < 0.96 ? 'sakit' : 'alpha'
      records.push({
        id: uid('a_'),
        sessionId: s.id,
        memberId: m.id,
        status,
        checkInAt: status === 'hadir' ? Date.now() : undefined,
      })
    }
  }
  await db.attendance.bulkPut(records as never)

  // Satu drill contoh dengan 2 set, supaya editor formasi tidak kosong.
  const drillId = uid('d_')
  await db.drills.put({
    id: drillId,
    name: 'Demo — Formasi Pembuka',
    showTitle: 'Contoh Show',
    field: { ...DEFAULT_FIELD },
    tempo: 120,
    beatsPerCount: 1,
    rosterIds: members.map((m) => m.id),
    createdAt: Date.now(),
    updatedAt: Date.now(),
  })

  const makeBlock = (): Record<string, DrillPoint> => {
    const pts: Record<string, DrillPoint> = {}
    const cols = 6
    members.forEach((m, i) => {
      const col = i % cols
      const row = Math.floor(i / cols)
      pts[m.id] = {
        x: (col - (cols - 1) / 2) * 4, // 4 yard antar kolom
        y: -10 + row * 5,
        facing: 'front',
      }
    })
    return pts
  }
  const makeArc = (): Record<string, DrillPoint> => {
    const pts: Record<string, DrillPoint> = {}
    const n = members.length
    members.forEach((m, i) => {
      const t = n === 1 ? 0.5 : i / (n - 1)
      const ang = Math.PI * (0.15 + 0.7 * t)
      pts[m.id] = {
        x: -Math.cos(ang) * 20,
        y: -22 + Math.sin(ang) * 22,
        facing: 'front',
      }
    })
    return pts
  }

  const sets: DrillSet[] = [
    { id: uid('set_'), drillId, order: 0, name: 'Set 1 — Blok', counts: 16, points: makeBlock(), createdAt: Date.now(), notes: '' },
    { id: uid('set_'), drillId, order: 1, name: 'Set 2 — Busur', counts: 0, points: makeArc(), createdAt: Date.now(), notes: '' },
  ]
  await db.sets.bulkPut(sets)

  // Satu lagu contoh dengan tempo map sederhana.
  await db.songs.put({
    id: uid('song_'),
    title: 'Contoh — Opening Number',
    composer: 'Arr. Pelatih',
    bpm: 120,
    beats: 4,
    key: 'Bb',
    notes: 'Gunakan metronom 120 untuk latihan langkah.',
    tempoMap: [
      { id: uid('tm_'), label: 'Intro', measure: 1, bpm: 92, beats: 4 },
      { id: uid('tm_'), label: 'A', measure: 9, bpm: 120, beats: 4 },
      { id: uid('tm_'), label: 'B — lebih cepat', measure: 25, bpm: 132, beats: 4 },
      { id: uid('tm_'), label: 'Outro', measure: 41, bpm: 100, beats: 4 },
    ],
    createdAt: Date.now(),
  })

  return members.length
}

export async function wipeAllData() {
  await db.transaction(
    'rw',
    [
      db.members,
      db.sessions,
      db.attendance,
      db.drills,
      db.sets,
      db.songs,
      db.targetSetoran,
      db.setoran,
      db.logPerubahan,
    ],
    async () => {
      await Promise.all([
        db.members.clear(),
        db.sessions.clear(),
        db.attendance.clear(),
        db.drills.clear(),
        db.sets.clear(),
        db.songs.clear(),
        db.targetSetoran.clear(),
        db.setoran.clear(),
        db.logPerubahan.clear(),
      ])
    },
  )
}
