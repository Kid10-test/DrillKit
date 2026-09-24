import { useEffect, useMemo, useState } from 'react'
import type { Session } from '../db/types'
import {
  bacaNotif,
  bacaTutup,
  bangunICS,
  bisaNotifikasi,
  butuhNotifikasi,
  hariStr,
  namaBerkasICS,
  sesiMendesak,
  tampilkanNotifikasi,
  tandaiNotif,
  teksNotifikasi,
  tutupHariIni,
} from '../lib/pengingat'
import { downloadFile, relativeDay } from '../lib/utils'
import { Button, Card } from './ui'

/**
 * C3 — spanduk "jadwal terdekat" + tombol kalender (.ics).
 *
 * Dipakai dua sisi: Dashboard pelatih dan tab Jadwal anggota. Isinya sesi
 * hari ini & besok yang belum ditutup hari ini. Menutup spanduk hanya
 * menyembunyikan sesi itu sampai besok (localStorage) — jadwalnya sendiri
 * tidak diapa-apakan.
 *
 * Notifikasi sistem dikirim sekali per sesi per hari, saat aplikasi dibuka
 * dan izinnya sudah ada. Meminta izinnya lewat tombol di spanduk — tidak
 * otomatis, supaya tidak muncul tiba-tiba.
 */

/** Unduh satu sesi sebagai berkas kalender (.ics) berisi dua alarm. */
export function unduhICS(s: Session) {
  downloadFile(namaBerkasICS(s), bangunICS(s), 'text/calendar')
}

export function PengingatJadwal({ sessions, prefix }: { sessions: Session[]; prefix: string }) {
  // Waktu dibekukan saat dibuka: spanduk adalah potret "saat aplikasi
  // dibuka", bukan penghitung mundur yang hidup.
  const [sekarang] = useState(() => Date.now())
  const [izin, setIzin] = useState<string>(() => (bisaNotifikasi() ? Notification.permission : 'tak-ada'))
  const [ditutup, setDitutup] = useState(0)
  const hari = hariStr(sekarang)
  const simpan = typeof localStorage !== 'undefined' ? localStorage : null

  const daftar = useMemo(
    () => sesiMendesak(sessions, sekarang).filter((s) => bacaTutup(simpan, s.id) !== hari),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessions, sekarang, hari, ditutup],
  )

  useEffect(() => {
    if (izin !== 'granted') return
    const kini = Date.now()
    for (const s of sesiMendesak(sessions, kini)) {
      if (!butuhNotifikasi(s, kini) || bacaNotif(simpan, s.id) === hariStr(kini)) continue
      const { judul, isi } = teksNotifikasi(s, kini)
      if (tampilkanNotifikasi(judul, isi)) tandaiNotif(simpan, s.id, hariStr(kini))
    }
    // `simpan` stabil (localStorage); notifikasi idempoten via `bacaNotif`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [izin, sessions])

  function tutup(id: string) {
    tutupHariIni(simpan, id, hari)
    setDitutup((n) => n + 1)
  }

  async function mintaIzin() {
    try {
      setIzin(await Notification.requestPermission())
    } catch {
      setIzin(bisaNotifikasi() ? Notification.permission : 'tak-ada')
    }
  }

  if (!daftar.length) return null

  return (
    <Card data-testid={`${prefix}-spanduk`} className="border-amber-500/30 bg-amber-500/10">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-amber-100">Jadwal terdekat — jangan lupa</p>
        {izin === 'default' && (
          <Button size="sm" variant="ghost" data-testid={`${prefix}-izin`} onClick={mintaIzin}>
            Izinkan notifikasi
          </Button>
        )}
      </div>
      <ul className="mt-2 space-y-1.5">
        {daftar.map((s) => (
          <li
            key={s.id}
            className="flex items-center justify-between gap-2 rounded-lg bg-slate-950/40 px-3 py-2"
          >
            <div className="min-w-0">
              <p className="truncate text-sm text-slate-100">{s.title}</p>
              <p className="text-xs text-slate-400">
                {relativeDay(s.date)} · {s.startTime}–{s.endTime}
                {s.place ? ` · ${s.place}` : ''}
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="sm" variant="ghost" data-testid={`${prefix}-ics-${s.id}`} onClick={() => unduhICS(s)}>
                Kalender
              </Button>
              <Button
                size="sm"
                variant="ghost"
                data-testid={`${prefix}-tutup-${s.id}`}
                onClick={() => tutup(s.id)}
                aria-label={`Tutup pengingat ${s.title}`}
              >
                Tutup
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </Card>
  )
}
