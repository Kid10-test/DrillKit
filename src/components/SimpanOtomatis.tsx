import { useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import {
  JEDA_PERIKSA_MS,
  didukung,
  lepas,
  mintaIzin,
  pasang,
  simpan,
  simpanBilaPerlu,
  ukuran,
} from '../lib/simpanOtomatis'
import { Badge, Button, useToast } from './ui'

/**
 * 1b — Simpan otomatis ke berkas.
 *
 * Dua komponen dalam satu berkas karena keduanya hanya membungkus modul
 * `lib/simpanOtomatis.ts`: yang satu menampilkan keadaannya, yang satu
 * menjalankannya di belakang layar.
 */

/** "baru saja" · "7 menit lalu" · "kemarin 09.14" */
function kapan(at: number): string {
  if (!at) return 'belum pernah'
  const beda = Date.now() - at
  if (beda < 60_000) return 'baru saja'
  if (beda < 3_600_000) return `${Math.floor(beda / 60_000)} menit lalu`
  if (beda < 86_400_000) return `${Math.floor(beda / 3_600_000)} jam lalu`
  const hari = Math.floor(beda / 86_400_000)
  if (hari === 1) return 'kemarin'
  return `${hari} hari lalu`
}

/** Apakah izin menulis masih berlaku — diperiksa ulang tiap kali daftar berubah. */
function pakaiIzin(pegangan: unknown): boolean {
  const p = pegangan as {
    queryPermission?: (d: { mode: 'readwrite' }) => Promise<PermissionState>
  }
  return typeof p?.queryPermission === 'function'
}

export function KartuSimpanOtomatis() {
  const toast = useToast()
  const simpanan = useLiveQuery(() => db.simpanan.get('utama'), [], undefined)
  const [izin, setIzin] = useState(false)
  const [sedang, setSedang] = useState(false)

  // Izin tidak bisa dibaca sekali lalu diingat: browser bisa mencabutnya
  // kapan saja, termasuk di antara dua kali halaman dibuka.
  useEffect(() => {
    let hidup = true
    if (!simpanan) {
      setIzin(false)
      return
    }
    const p = simpanan.pegangan as {
      queryPermission: (d: { mode: 'readwrite' }) => Promise<PermissionState>
    }
    p.queryPermission({ mode: 'readwrite' })
      .then((v) => hidup && setIzin(v === 'granted'))
      .catch(() => hidup && setIzin(false))
    return () => {
      hidup = false
    }
  }, [simpanan])

  async function pasangBerkas() {
    setSedang(true)
    try {
      const r = await pasang()
      if (r.ok) {
        toast.push(`Terhubung ke ${r.nama} — menyimpan sendiri mulai sekarang`)
        await simpan()
      } else {
        toast.push('Berkas belum dipilih', 'info')
      }
    } finally {
      setSedang(false)
    }
  }

  async function simpanSekarang() {
    setSedang(true)
    try {
      const { hasil, bytes } = await simpan()
      if (hasil === 'tersimpan') toast.push(`Tersimpan ke berkas${bytes ? ` · ${ukuran(bytes)}` : ''}`)
      else if (hasil === 'perlu-izin') toast.push('Browser minta izin ulang — tekan "Izinkan lagi"', 'info')
      else if (hasil === 'tidak-terpasang') toast.push('Belum ada berkas yang dipasang', 'info')
      else toast.push('Gagal menulis — mungkin berkasnya sudah dipindah', 'err')
    } finally {
      setSedang(false)
    }
  }

  async function izinkan() {
    const ok = await mintaIzin()
    setIzin(ok)
    toast.push(ok ? 'Izin diberikan' : 'Izin belum diberikan', ok ? undefined : 'info')
  }

  async function lepasBerkas() {
    await lepas()
    toast.push('Berhenti menyimpan otomatis', 'info')
  }

  /* --------------------------- keadaan: tak didukung ------------------------ */
  if (!didukung()) {
    return (
      <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-slate-200">Simpan otomatis ke berkas</p>
          <Badge className="border-slate-700 bg-slate-800/60 text-slate-400">
            tidak didukung di sini
          </Badge>
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
          Fitur ini memakai API yang cuma ada di <b>Chrome &amp; Edge versi komputer</b>.
          Di HP, Safari, dan Firefox, browser memang tidak mengizinkan aplikasi menulisi
          berkas tanpa kamu menyimpannya sendiri — jadi pakai tombol{' '}
          <b>Ekspor backup</b> di bawah seperti biasa.
        </p>
      </div>
    )
  }

  /* ---------------------------- keadaan: terpasang -------------------------- */
  if (simpanan) {
    return (
      <div className="mb-4 rounded-xl border border-emerald-900/50 bg-emerald-950/20 p-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="text-xs font-semibold text-slate-200">Simpan otomatis ke berkas</p>
              {izin ? (
                <Badge className="border-emerald-800 bg-emerald-950/50 text-emerald-300">
                  aktif
                </Badge>
              ) : (
                <Badge className="border-amber-800 bg-amber-950/50 text-amber-300">
                  perlu izin ulang
                </Badge>
              )}
            </div>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
              Menyimpan ke <b className="text-slate-200">{simpanan.nama}</b> ·{' '}
              terakhir {kapan(simpanan.at)}
              {pakaiIzin(simpanan.pegangan) && izin && ' · diperbarui sendiri tiap ~15 menit'}
            </p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Ini menyelamatkanmu kalau <b>data browser dibersihkan</b>. Tapi berkasnya
              masih ada di perangkat ini — untuk aman dari perangkat hilang atau rusak,
              tetap salin berkas itu ke Google Drive atau emailmu.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {!izin && (
              <Button variant="primary" onClick={() => void izinkan()} disabled={sedang}>
                Izinkan lagi
              </Button>
            )}
            <Button variant="soft" onClick={() => void simpanSekarang()} disabled={sedang}>
              Simpan sekarang
            </Button>
            <Button variant="ghost" onClick={() => void lepasBerkas()} disabled={sedang}>
              Lepas
            </Button>
          </div>
        </div>
      </div>
    )
  }

  /* --------------------------- keadaan: belum terpasang ---------------------- */
  return (
    <div className="mb-4 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-slate-200">Simpan otomatis ke berkas</p>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
            Pilih satu berkas sekali, lalu aplikasi menulisi berkas itu sendiri setiap
            beberapa menit — tidak perlu menekan tombol lagi. Berkasnya tetap milikmu,
            di folder yang kamu pilih.
          </p>
        </div>
        <Button variant="soft" onClick={() => void pasangBerkas()} disabled={sedang}>
          {sedang ? 'Menyiapkan…' : 'Pasang berkas'}
        </Button>
      </div>
    </div>
  )
}

/**
 * Penjaga yang berjalan di belakang layar.
 *
 * Sengaja dipasang di tingkat aplikasi (`App`), bukan di halaman Pengaturan:
 * maksud fitur ini adalah menyimpan tanpa perlu diingat, dan pelatih tidak
 * selalu membuka halaman Pengaturan.
 *
 * Tidak melakukan apa-apa kalau belum ada berkas yang dipasang, dan tidak
 * pernah menampilkan apa pun.
 */
export function PenjagaSimpanOtomatis() {
  useEffect(() => {
    if (!didukung()) return
    let hidup = true

    const jalankan = async () => {
      if (!hidup || typeof document !== 'undefined' && document.hidden) return
      try {
        await simpanBilaPerlu()
      } catch {
        // Menyimpan otomatis tidak boleh pernah mengganggu pemakaian.
      }
    }

    // Sekali saat aplikasi dibuka, lalu tiap beberapa menit.
    void jalankan()
    const timer = window.setInterval(() => void jalankan(), JEDA_PERIKSA_MS)
    return () => {
      hidup = false
      window.clearInterval(timer)
    }
  }, [])

  return null
}
