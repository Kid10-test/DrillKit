import { useState } from 'react'
import { muatUlangKeRilisBaru, useRilisBaru } from '../hooks/useRilisBaru'

/**
 * N13 — penanda "ada versi baru".
 *
 * Mengapa perlu: aplikasi ini sengaja tidak pernah memuat ulang dirinya
 * sendiri, sebab memuat ulang otomatis akan mematikan metronom di
 * tengah latihan. Konsekuensinya sebuah perangkat bisa menjalankan
 * versi lama berhari-hari. Pelatih yang baru mengunggah perbaikan lalu
 * melihat anak-anaknya tetap memakai yang lama akan mengira
 * unggahannya gagal — padahal unggahannya berhasil.
 *
 * Penanda ini mengembalikan keputusannya ke pemakai: SATU tombol,
 * dijelaskan dengan bahasa yang tidak menakutkan.
 */
export default function PenandaRilis() {
  const ada = useRilisBaru()
  const [ditutup, setDitutup] = useState(false)
  const [sedang, setSedang] = useState(false)

  if (!ada || ditutup) return null

  return (
    <div
      data-testid="penanda-rilis-baru"
      className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3"
    >
      <div className="w-full max-w-md rounded-xl border border-sky-500/40 bg-slate-900/95 px-4 py-3 shadow-lg shadow-black/40 backdrop-blur">
        <p className="text-sm font-semibold text-sky-300">Ada versi baru DrillKit</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-300">
          Situsnya memuat rilis yang lebih baru daripada yang sedang terbuka di perangkat ini.
          Data Anda tidak akan hilang — aplikasi hanya akan dibuka kembali dengan versi yang baru.
        </p>
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            data-testid="tombol-muat-ulang-rilis"
            disabled={sedang}
            onClick={() => {
              setSedang(true)
              void muatUlangKeRilisBaru()
            }}
            className="flex-1 rounded-lg bg-sky-500 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-sky-400 disabled:opacity-60"
          >
            {sedang ? 'Memuat ulang…' : 'Muat ulang sekarang'}
          </button>
          <button
            type="button"
            data-testid="tombol-nanti-rilis"
            onClick={() => setDitutup(true)}
            className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-medium text-slate-300 transition hover:bg-slate-800"
          >
            Nanti
          </button>
        </div>
      </div>
    </div>
  )
}
