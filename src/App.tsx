import { Suspense, lazy, useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { db } from './db/db'
import Layout from './components/Layout'
import PenandaRilis from './components/PenandaRilis'
import { PenjagaSimpanOtomatis } from './components/SimpanOtomatis'
import { ErrorBoundary, ToastProvider } from './components/ui'
import { KioskProvider } from './hooks/useKiosk'
import { useBootstrap } from './hooks/useSettings'
import Dashboard from './pages/Dashboard'
/**
 * #5 — halaman dimuat malas (code splitting) per rute. Sebelumnya seluruh
 * aplikasi — termasuk editor drill yang besar — dibundel jadi satu berkas
 * ±870 KB yang harus diunduh sebelum halaman pertama tampil. Kini muatan
 * awal hanya cangkang + Dashboard; halaman lain diunduh saat dibuka.
 * Dashboard sengaja TIDAK malas: ia halaman pertama yang dilihat.
 */
const Members = lazy(() => import('./pages/Members'))
const Attendance = lazy(() => import('./pages/Attendance'))
const Schedule = lazy(() => import('./pages/Schedule'))
const Drill = lazy(() => import('./pages/Drill'))
const Music = lazy(() => import('./pages/Music'))
const Lomba = lazy(() => import('./pages/Lomba'))
const Data = lazy(() => import('./pages/Data'))
const Evaluasi = lazy(() => import('./pages/Evaluasi'))
const Share = lazy(() => import('./pages/Share'))
const Settings = lazy(() => import('./pages/Settings'))

/**
 * DrillKit menyimpan semua data di IndexedDB. Ada situasi where penyimpanan
 * itu tidak bisa dipakai — misalnya halaman dibuka di dalam iframe yang
 * disandbox tanpa akses penyimpanan, atau mode penyamaran tertentu.
 * Daripada menampilkan aplikasi yang rusak, tampilkan penjelasan yang jelas.
 */
function useStorageStatus(): 'checking' | 'ready' | 'blocked' {
  const [state, setState] = useState<'checking' | 'ready' | 'blocked'>('checking')
  useEffect(() => {
    let alive = true
    db.open()
      .then(() => alive && setState('ready'))
      .catch(() => alive && setState('blocked'))
    return () => {
      alive = false
    }
  }, [])
  return state
}

function StorageBlocked() {
  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-5 text-sm text-amber-100">
        <p className="text-base font-semibold">Penyimpanan browser belum bisa dipakai</p>
        <p className="mt-2 leading-relaxed text-amber-200/90">
          DrillKit menyimpan data di perangkat ini (IndexedDB), tapi akses penyimpanan sedang diblokir.
          Ini biasanya terjadi kalau halaman dibuka <b>di dalam jendela pratinjau/iframe</b>, atau
          browser sedang mode penyamaran.
        </p>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-amber-200/90">
          <li>Buka berkasnya di <b>tab browser biasa</b> (bukan di dalam pratinjau).</li>
          <li>Kalau di HP: buka dari aplikasi Files → pilih <b>Chrome</b>, lalu langsung dipakai.</li>
          <li>Atau hosting-kan dulu (gratis) supaya punya alamat sendiri — lihat DEPLOY.md.</li>
        </ul>
      </div>
    </div>
  )
}

export default function App() {
  useBootstrap()
  const storage = useStorageStatus()

  if (storage === 'checking')
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-slate-500">
        Menyiapkan DrillKit…
      </div>
    )
  if (storage === 'blocked') return <StorageBlocked />

  return (
    <ToastProvider>
      <KioskProvider>
      {/* N13 — penanda "ada versi baru". Sengaja di luar <Layout> supaya
          tampil di halaman mana pun, dan sengaja di bawah supaya tidak
          menutupi apa yang sedang dikerjakan pemakai. */}
      <PenandaRilis />
      {/* 1b — penyimpan otomatis ke berkas. Tidak menampilkan apa pun;
          ia hanya menulis bila berkasnya sudah dipasang. */}
      <PenjagaSimpanOtomatis />
      <Layout>
        <ErrorBoundary>
        <Suspense
          fallback={
            <div
              data-testid="memuat-halaman"
              className="flex min-h-[40vh] items-center justify-center text-sm text-slate-500"
            >
              Memuat halaman…
            </div>
          }
        >
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/anggota" element={<Members />} />
          <Route path="/absensi" element={<Attendance />} />
          <Route path="/jadwal" element={<Schedule />} />
          <Route path="/drill" element={<Drill />} />
          <Route path="/musik" element={<Music />} />
          <Route path="/lomba" element={<Lomba />} />
          <Route path="/berbagi" element={<Share />} />
          <Route path="/data" element={<Data />} />
          <Route path="/evaluasi" element={<Evaluasi />} />
          <Route path="/pengaturan" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </Layout>
      </KioskProvider>
    </ToastProvider>
  )
}
