import { capBuildSingkat } from '../lib/capBuild'
import { useEffect, useMemo, useState } from 'react'
import { Navigate, NavLink, useLocation } from 'react-router-dom'
import { applySectionConfig } from '../lib/utils'
import { cx } from '../lib/utils'
import { useSettings } from '../hooks/useSettings'
import { KioskBanner, KioskButton } from './KioskLock'
import { useMemberMode } from '../hooks/useMemberMode'
import { RUTE_ANGGOTA, bolehBuka, pernahMemilih } from '../lib/modePerangkat'
import { PilihMode } from './PilihMode'
import {
  IconCalendar,
  IconFlag,
  IconGrid,
  IconHome,
  IconMusic,
  IconQr,
  IconSettings,
  IconShare,
  IconCheck,
  IconUpload,
  IconUsers,
} from './Icons'

export interface NavItem {
  to: string
  label: string
  icon: (p: { size?: number; className?: string }) => JSX.Element
  short: string
}

export const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard', short: 'Beranda', icon: IconHome },
  { to: '/anggota', label: 'Anggota', short: 'Anggota', icon: IconUsers },
  { to: '/absensi', label: 'Absensi', short: 'Absensi', icon: IconQr },
  { to: '/evaluasi', label: 'Evaluasi & kemajuan', short: 'Evaluasi', icon: IconCheck },
  { to: '/jadwal', label: 'Jadwal', short: 'Jadwal', icon: IconCalendar },
  { to: '/drill', label: 'Drill & Formasi', short: 'Drill', icon: IconGrid },
  { to: '/musik', label: 'Musik & Metronom', short: 'Musik', icon: IconMusic },
  { to: '/lomba', label: 'Run sheet hari lomba', short: 'Lomba', icon: IconFlag },
  { to: '/berbagi', label: 'Berbagi', short: 'Berbagi', icon: IconShare },
  { to: '/data', label: 'Impor & ekspor data', short: 'Data', icon: IconUpload },
  { to: '/pengaturan', label: 'Pengaturan', short: 'Setelan', icon: IconSettings },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const settings = useSettings()
  const loc = useLocation()
  /**
   * Pertanyaan pertama: pelatih atau anggota?
   *
   * Tanpa ini, perangkat baru langsung masuk mode pelatih — sehingga
   * anggota yang baru saja disuruh membuka satu berkas malah melihat
   * layar ekspor pelatih. Diletakkan SETELAH semua hook supaya aturan
   * hook tidak dilanggar.
   */
  const sudahPilih = useMemo(pernahMemilih, [])
  /**
   * Mode anggota: sembunyikan seluruh menu pelatih.
   *
   * `useMemberMode` sudah ada sejak lama tetapi tidak pernah dipakai,
   * sehingga HP anggota menampilkan 11 menu pelatih yang sebagian besar
   * kosong — membingungkan, walau bukan kebocoran data karena halaman-halaman
   * itu membaca basis data perangkat sendiri, yang memang kosong.
   */
  const mode = useMemberMode()
  /**
   * Penjaga rute.
   *
   * Menu sudah disaring, tetapi itu tidak cukup: mengetik `#/anggota` di
   * bilah alamat tetap membuka halamannya. Semua rute selain `/berbagi`
   * dialihkan selama mode anggota.
   */
  const ruteDiblok = !bolehBuka(mode, loc.pathname)
  const nav = useMemo<NavItem[]>(() => {
    if (mode !== 'member') return NAV
    // Nama "Berbagi" tidak masuk akal bagi anggota; bagi mereka itu timnya.
    return NAV.filter((n) => n.to === '/berbagi').map((n) => ({ ...n, label: 'Tim saya', short: 'Tim' }))
  }, [mode])
  // Terapkan daftar section milik tim (nama & warna bisa diubah di Pengaturan).
  const [, bumpSections] = useState(0)
  useEffect(() => {
    applySectionConfig(settings?.sections)
    bumpSections((v) => v + 1)
  }, [settings?.sections])

  // Deteksi "dijalankan di dalam iframe" (mis. panel pratinjau). Di situ browser
  // biasanya memblokir jendela baru & unduhan, jadi cetak/ekspor bisa gagal.
  const [showFrameNotice, setShowFrameNotice] = useState(
    () => window.self !== window.top && localStorage.getItem('drillkit.frameNotice') !== 'off',
  )

  const [showPortableNotice, setShowPortableNotice] = useState(
    () => location.protocol === 'file:' && localStorage.getItem('drillkit.portableNotice') !== 'off',
  )

  /*
   * Layar sambutan menutupi seluruh aplikasi sampai pilihannya dibuat.
   *
   * Setelah memilih, halaman **dimuat ulang** — bukan sekadar menyembunyikan
   * lapisan ini. Alasannya penting: mode dibaca sekali saat komponen
   * dipasang (`useMemberMode`, `pernahMemilih`), jadi tanpa memuat ulang
   * menu dan penjaga rute akan tetap memakai mode lama. Menyembunyikan
   * lapisan tanpa memuat ulang akan memperlihatkan aplikasi dalam keadaan
   * yang setengah berubah.
   */
  if (!sudahPilih) {
    return <PilihMode onPilih={() => window.location.reload()} />
  }

  return (
    <div className="min-h-full bg-slate-950 text-slate-200">
      {/* Sidebar (desktop) */}
      <aside
        data-kiosk-allow
        className="no-print fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-slate-800 bg-slate-900/60 px-3 py-4 lg:flex"
      >
        <div className="mb-6 flex items-center gap-2.5 px-2">
          <Logo />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-slate-100">
              {settings?.teamName ?? 'DrillKit'}
            </p>
            <p className="truncate text-[11px] text-slate-500">{settings?.coachName ?? 'Pelatih'}</p>
          </div>
        </div>
        <nav data-kiosk-allow className="flex flex-col gap-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cx(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition',
                  isActive
                    ? 'bg-emerald-600/15 font-medium text-emerald-300 ring-1 ring-emerald-600/25'
                    : 'text-slate-400 hover:bg-slate-800/70 hover:text-slate-100',
                )
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto px-3 pt-4">
          <KioskButton full />
          <p className="pt-3 text-[11px] leading-relaxed text-slate-600">
            DrillKit v0.1 · rilis{' '}
            <span data-testid="cap-build-singkat">{capBuildSingkat()}</span> — data tersimpan di
            perangkat ini, tetap jalan offline.
          </p>
        </div>
      </aside>

      {/* Konten */}
      <main className="pb-24 lg:pl-60 lg:pb-10">
        {showFrameNotice && (
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pt-4 sm:px-6">
            <div className="flex w-full items-start gap-3 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2.5 text-xs text-sky-100">
              <span className="mt-0.5">🖨️</span>
              <p className="flex-1 leading-relaxed">
                Aplikasi berjalan di dalam <b>jendela pratinjau</b>. Browser biasanya memblokir
                <b> cetak</b> dan <b>unduh berkas</b> di situ. Untuk memakainya, buka aplikasi di
                <b> tab browser sendiri</b> — misalnya berkas <code className="rounded bg-sky-500/20 px-1">DrillKit.html</code>
                {' '}atau alamat hosting-mu.
              </p>
              <button
                data-kiosk-allow
                onClick={() => {
                  localStorage.setItem('drillkit.frameNotice', 'off')
                  setShowFrameNotice(false)
                }}
                className="rounded px-1 text-sky-300/80 hover:bg-sky-500/20"
                title="Sembunyikan"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        {showPortableNotice && (
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 pt-4 sm:px-6">
            <div className="flex w-full items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-xs text-amber-200">
              <span className="mt-0.5">ℹ️</span>
              <p className="flex-1 leading-relaxed">
                <b>Mode portabel</b> — aplikasi dibuka langsung dari berkas, jadi belum bisa dipasang
                ke layar utama atau dipakai saat benar-benar offline. <b>Data tetap tersimpan</b> di
                browser ini. Supaya bisa di-install seperti aplikasi biasa, hosting-kan dulu
                (gratis) — lihat <code className="rounded bg-amber-500/20 px-1">DEPLOY.md</code>.
              </p>
              <button
                data-kiosk-allow
                onClick={() => {
                  localStorage.setItem('drillkit.portableNotice', 'off')
                  setShowPortableNotice(false)
                }}
                className="rounded px-1 text-amber-300/80 hover:bg-amber-500/20"
                title="Sembunyikan"
              >
                ✕
              </button>
            </div>
          </div>
        )}
        <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-7">
          {ruteDiblok && <Navigate to={RUTE_ANGGOTA} replace />}
          <KioskBanner />
          {/* Header mobile */}
          <div className="mb-4 flex items-center justify-between lg:hidden">
            <div className="flex items-center gap-2.5">
              <Logo />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-slate-100">
                  {settings?.teamName ?? 'DrillKit'}
                </p>
                <p className="text-[11px] text-slate-500">{loc.pathname === '/' ? 'Dashboard' : ''}</p>
              </div>
            </div>
            <KioskButton />
          </div>
          {children}
        </div>
      </main>

      {/* Bottom nav (mobile) */}
      <nav
        data-kiosk-allow
        className="no-print fixed inset-x-0 bottom-0 z-40 border-t border-slate-800 bg-slate-900/95 backdrop-blur lg:hidden"
      >
        <div className="scroll-thin flex overflow-x-auto px-1 pb-[env(safe-area-inset-bottom)]">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                cx(
                  'flex min-w-[72px] flex-1 flex-col items-center gap-1 px-2 py-2.5 text-[10px] font-medium transition',
                  isActive ? 'text-emerald-400' : 'text-slate-500',
                )
              }
            >
              <item.icon size={20} />
              {item.short}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

function Logo() {
  return (
    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 shadow-md">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round">
        <path d="M3 17h18M3 12h18M6 7h.01M12 7h.01M18 7h.01" />
      </svg>
    </div>
  )
}
