import { useEffect, useMemo, useRef, useState } from 'react'
import type { AttendanceRecord, Member } from '../db/types'
import { Badge, Button, Modal, useToast } from './ui'
import { beep, buzz } from '../lib/feedback'
import { cx, formatTime } from '../lib/utils'
import { bacaModeNama, cocokCari, namaTampil } from '../lib/namaAnggota'
import { NamaTampil } from './NamaTampil'
import { IconCheck, IconQr, IconSearch } from './Icons'

/**
 * Berapa lama satu kode dianggap "baru saja dibaca".
 * Kamera membaca berkali-kali per detik; tanpa jeda ini, satu kartu yang
 * diam di depan kamera akan tercatat puluhan kali.
 */
const DEDUPE_MS = 4000

/** Jarak minimal antar pembacaan QR (ms) — 120 ms ≈ 8 kali per detik. */
const SCAN_EVERY_MS = 120

/** Berapa lama nama anggota ditampilkan di layar setelah terbaca. */
const FLASH_MS = 1800

/** Maksimum baris di daftar "Baru saja masuk". */
const MAX_RECENT = 20

type Flash = { kind: 'ok' | 'dupe' | 'unknown'; text: string; sub: string; at: number }
type Recent = { recordId: string; memberId: string; raw: string; at: number }

/**
 * Pemindai QR **beruntun**: kamera menyala terus, tiap kartu yang terbaca
 * langsung tercatat hadir (bunyi + getar), dan daftar "Baru saja masuk"
 * menampilkan hasilnya sekaligus menyediakan tombol batal.
 *
 * Yang penting: kamera **tidak boleh mati-nyala** di antara dua kartu,
 * karena menyalakan kamera butuh waktu 1–2 detik.
 */
export default function ScanQrModal({
  open,
  onClose,
  members,
  records,
  sessionId,
  sessionTitle,
  hadirCount,
  totalActive,
  onMark,
  onUndo,
}: {
  open: boolean
  onClose: () => void
  members: Member[]
  records: AttendanceRecord[]
  sessionId: string
  sessionTitle?: string
  hadirCount: number
  totalActive: number
  /** Tandai hadir. Mengembalikan id record absensi (dipakai untuk membatalkan). */
  onMark: (memberId: string) => Promise<string>
  onUndo: (recordId: string) => Promise<void>
}) {
  const toast = useToast()
  const videoRef = useRef<HTMLVideoElement>(null)

  const [camError, setCamError] = useState('')
  const [flash, setFlash] = useState<Flash | null>(null)
  const [recent, setRecent] = useState<Recent[]>([])
  const [manual, setManual] = useState('')
  const [sound, setSound] = useState(true)
  const [vibrate, setVibrate] = useState(true)
  const [facing, setFacing] = useState<'environment' | 'user'>('environment')

  /*
   * Semua data yang dibaca di dalam loop pemindaian disimpan di ref.
   * Alasannya: kalau kita memakai nilai dari render, setiap kali ada data
   * baru (mis. satu anggota tercatat hadir) React merender ulang dan efek
   * kamera akan berjalan ulang — kamera mati lalu menyala lagi.
   * Dengan ref, efek kamera cukup berjalan saat dibuka / kamera dibalik.
   */
  const membersRef = useRef(members)
  const recordsRef = useRef(records)
  const sessionIdRef = useRef(sessionId)
  const onMarkRef = useRef(onMark)
  const onUndoRef = useRef(onUndo)
  const toastRef = useRef(toast)
  const soundRef = useRef(sound)
  const vibRef = useRef(vibrate)
  membersRef.current = members
  recordsRef.current = records
  sessionIdRef.current = sessionId
  onMarkRef.current = onMark
  onUndoRef.current = onUndo
  toastRef.current = toast
  soundRef.current = sound
  vibRef.current = vibrate

  /** kode QR → waktu terakhir kali diproses (untuk mencegah dobel). */
  const seenRef = useRef<Map<string, number>>(new Map())

  // Buka pemindai = kesempatan baru: kode yang tadi dibaca boleh dibaca lagi.
  useEffect(() => {
    if (open) seenRef.current.clear()
  }, [open])

  // Sembunyikan nama yang muncul di layar setelah beberapa saat.
  useEffect(() => {
    if (!flash) return
    const t = window.setTimeout(() => setFlash(null), FLASH_MS)
    return () => window.clearTimeout(t)
  }, [flash])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    let stream: MediaStream | undefined
    let raf = 0
    let busy = false
    let lastScan = 0
    setCamError('')

    /** Matikan kamera dan hentikan loop. */
    function beres() {
      cancelAnimationFrame(raf)
      stream?.getTracks().forEach((t) => t.stop())
      stream = undefined
      if (videoRef.current) videoRef.current.srcObject = null
    }

    /** Satu kode terbaca — tentukan: catat, sudah ada, atau tidak dikenal. */
    function proses(raw: string) {
      const now = Date.now()
      const terakhir = seenRef.current.get(raw)
      if (terakhir && now - terakhir < DEDUPE_MS) return // kartu masih di depan kamera
      seenRef.current.set(raw, now)

      const key = raw.trim().toLowerCase()
      const m = membersRef.current.find(
        (x) => x.token === raw || x.token.toLowerCase() === key || x.code.toLowerCase() === key,
      )

      if (!m) {
        if (soundRef.current) beep('unknown')
        if (vibRef.current) buzz('unknown')
        setFlash({ kind: 'unknown', text: 'Kode tidak dikenal', sub: raw.slice(0, 14), at: now })
        return
      }

      const sudah = recordsRef.current.some(
        (r) => r.sessionId === sessionIdRef.current && r.memberId === m.id && r.status === 'hadir',
      )
      if (sudah) {
        if (soundRef.current) beep('dupe')
        if (vibRef.current) buzz('dupe')
        setFlash({ kind: 'dupe', text: `${namaTampil(m, bacaModeNama())} sudah tercatat`, sub: m.code, at: now })
        return
      }

      void onMarkRef.current(m.id).then((recordId) => {
        if (recordId) setRecent((s) => [{ recordId, memberId: m.id, raw, at: now }, ...s].slice(0, MAX_RECENT))
      })
      if (soundRef.current) beep('ok')
      if (vibRef.current) buzz('ok')
      setFlash({ kind: 'ok', text: namaTampil(m, bacaModeNama()), sub: m.code, at: now })
      setCamError('')
    }

    async function mulai() {
      // 1. Nyalakan kamera. Kalau kamera belakang tidak ada, coba apa saja.
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing } })
      } catch {
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: true })
        } catch {
          setCamError('Kamera tidak tersedia atau izinnya ditolak. Pakai kolom ketik kode di bawah.')
          return
        }
      }
      if (cancelled) return beres()

      const video = videoRef.current
      if (!video) return beres()
      video.srcObject = stream
      await video.play().catch(() => undefined)

      // 2. Pemindaian otomatis butuh BarcodeDetector.
      const BD = (window as unknown as {
        BarcodeDetector?: new (o?: { formats: string[] }) => {
          detect: (src: CanvasImageSource) => Promise<{ rawValue: string }[]>
        }
      }).BarcodeDetector
      if (!BD) {
        setCamError(
          'Browser ini belum bisa memindai otomatis. Kamera tetap menyala; pakai kolom ketik kode di bawah.',
        )
        return
      }

      // 3. Loop pemindaian. Kamera tetap menyala terus sampai modal ditutup.
      const detector = new BD({ formats: ['qr_code'] })
      const tick = (t: number) => {
        if (cancelled) return
        raf = requestAnimationFrame(tick)
        const v = videoRef.current
        if (busy || !v || v.readyState < 2) return
        if (t - lastScan < SCAN_EVERY_MS) return
        lastScan = t
        busy = true
        detector
          .detect(v)
          .then((codes) => {
            const raw = codes[0]?.rawValue
            if (raw) proses(raw)
          })
          .catch(() => undefined)
          .finally(() => {
            busy = false
          })
      }
      raf = requestAnimationFrame(tick)
    }

    void mulai()

    return () => {
      cancelled = true
      beres()
    }
  }, [open, facing])

  /**
   * Menandai hadir dari ketikan manual (kode/nama).
   * Logika ini sama dengan yang dipakai hasil pemindaian, hanya saja sumbernya
   * dari kolom ketik — jadi ditulis sekali di sini dan dipakai dua kali.
   */
  function tandaiManual(m: Member) {
    const sudah = recordsRef.current.some(
      (r) => r.sessionId === sessionIdRef.current && r.memberId === m.id && r.status === 'hadir',
    )
    if (sudah) {
      toastRef.current.push(`${namaTampil(m, bacaModeNama())} sudah tercatat hadir`, 'info')
      return
    }
    void onMarkRef.current(m.id).then((recordId) => {
      if (recordId)
        setRecent((s) => [{ recordId, memberId: m.id, raw: m.token, at: Date.now() }, ...s].slice(0, MAX_RECENT))
    })
    if (soundRef.current) beep('ok')
    if (vibRef.current) buzz('ok')
    setFlash({ kind: 'ok', text: namaTampil(m, bacaModeNama()), sub: m.code, at: Date.now() })
  }

  /** Hasil ketikan manual (kode atau nama), paling banyak 5. */
  const cocok = useMemo(() => {
    const s = manual.trim().toLowerCase()
    if (!s) return []
    return members
      .filter((m) => cocokCari(m, s))
      .slice(0, 5)
  }, [manual, members])

  const nama = useMemo(() => new Map(members.map((m) => [m.id, m])), [members])

  return (
    <Modal open={open} onClose={onClose} title="Scan QR beruntun" wide>
      {sessionTitle && <p className="text-xs text-slate-400">Sesi: {sessionTitle}</p>}

      {/* ------------------------------- Kamera ------------------------------- */}
      <div className="relative overflow-hidden rounded-xl bg-slate-950">
        <video ref={videoRef} className="h-56 w-full object-cover sm:h-64" playsInline muted autoPlay />
        {/* Bingkai bidik */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-32 w-32 rounded-2xl border-2 border-emerald-400/70 sm:h-40 sm:w-40" />
        </div>
        {/* Hasil pemindaian terakhir */}
        {flash && (
          <div
            className={cx(
              'absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold',
              flash.kind === 'ok' && 'bg-emerald-600 text-white',
              flash.kind === 'dupe' && 'bg-sky-600 text-white',
              flash.kind === 'unknown' && 'bg-amber-600 text-slate-950',
            )}
          >
            {flash.kind === 'ok' && <IconCheck size={16} />}
            {flash.kind === 'unknown' && <span className="text-base leading-none">?</span>}
            <span className="truncate">{flash.text}</span>
            <span className="shrink-0 text-xs font-normal opacity-80">{flash.sub}</span>
          </div>
        )}
      </div>

      {camError && <p className="text-xs text-amber-400">{camError}</p>}

      {/* --------------------------- Pengaturan cepat -------------------------- */}
      <div className="flex flex-wrap items-center gap-2">
        <Tombol on={sound} onClick={() => setSound((v) => !v)} label="Bunyi" />
        <Tombol on={vibrate} onClick={() => setVibrate((v) => !v)} label="Getar" />
        <Tombol on={false} onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))} label="Balik kamera" />
        <span className="ml-auto text-xs text-slate-400">
          Hadir <span className="font-semibold text-emerald-400">{hadirCount}</span> dari {totalActive}
        </span>
      </div>

      {/* ---------------------------- Baru saja masuk -------------------------- */}
      <div>
        <p className="mb-1 text-xs font-medium text-slate-400">
          Baru saja masuk {recent.length > 0 && <span className="text-slate-500">({recent.length})</span>}
        </p>
        {recent.length === 0 ? (
          <p className="rounded-lg border border-dashed border-slate-700 px-3 py-3 text-center text-xs text-slate-500">
            Arahkan kamera ke kartu QR anggota. Kamera tetap menyala, jadi bisa langsung beruntun.
          </p>
        ) : (
          <ul className="max-h-48 space-y-1 overflow-y-auto" data-testid="recent-list">
            {recent.map((r) => {
              const m = nama.get(r.memberId)
              return (
                <li
                  key={r.recordId}
                  className="flex items-center gap-2 rounded-lg border border-emerald-900/60 bg-emerald-950/30 px-3 py-1.5"
                >
                  <IconCheck size={14} className="shrink-0 text-emerald-400" />
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-100">{m ? <NamaTampil anggota={m} /> : r.memberId}</span>
                  <span className="shrink-0 text-[11px] text-slate-500">{m?.code}</span>
                  <span className="shrink-0 text-[11px] text-slate-500">{formatTime(r.at)}</span>
                  <button
                    onClick={() => {
                      void onUndoRef.current(r.recordId)
                      setRecent((s) => s.filter((x) => x.recordId !== r.recordId))
                      seenRef.current.delete(r.raw)
                      toastRef.current.push(`${m ? namaTampil(m, bacaModeNama()) : 'Data'} dibatalkan`, 'info')
                    }}
                    className="shrink-0 rounded-md border border-slate-700 px-2 py-0.5 text-[11px] text-slate-400 hover:border-rose-500 hover:text-rose-400"
                    title="Batalkan absensi ini"
                    data-testid="undo-scan"
                  >
                    Batalkan
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {/* ------------------------------ Ketik manual --------------------------- */}
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-400">
          Atau ketik kode / nama (Enter = tandai hadir)
        </label>
        <div className="relative">
          <IconSearch size={16} className="absolute left-3 top-2.5 text-slate-500" />
          <input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && cocok[0]) {
                tandaiManual(cocok[0])
                setManual('')
              }
            }}
            placeholder="Kode atau nama…"
            className="w-full rounded-lg border border-slate-700 bg-slate-950/60 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 outline-none focus:border-emerald-500"
          />
        </div>
        {cocok.length > 0 && (
          <div className="mt-2 space-y-1">
            {cocok.map((m) => (
              <button
                key={m.id}
                onClick={() => {
                  tandaiManual(m)
                  setManual('')
                }}
                className="flex w-full items-center justify-between rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-left text-sm hover:bg-slate-800"
              >
                <span className="text-slate-200"><NamaTampil anggota={m} /></span>
                <Badge>{m.code}</Badge>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-between">
        <span className="hidden items-center gap-1 text-[11px] text-slate-500 sm:flex">
          <IconQr size={12} /> Kartu QR ada di menu Anggota → ikon QR
        </span>
        <Button variant="ghost" onClick={onClose}>
          Selesai
        </Button>
      </div>
    </Modal>
  )
}

/** Tombol kecil bergaya chip untuk menyalakan/mematikan umpan balik. */
function Tombol({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        'rounded-full border px-3 py-1 text-xs font-medium transition',
        on ? 'border-emerald-500 bg-emerald-500/15 text-emerald-300' : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200',
      )}
    >
      {label}
      {on ? ' · aktif' : ''}
    </button>
  )
}
