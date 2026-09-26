/**
 * Tombol "Terbitkan ke anggota".
 *
 * Menulis berkas grup — bukan berkas per anggota — ke repo materi.
 * Saat luring, tombol ditolak. Unduh manual tetap ada di kartu sebelah.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ShareBundle } from '../db/types'
import { Button, Card, useToast } from './ui'
import { IconUpload } from './Icons'
import { namaDenganPanggilan } from '../lib/namaAnggota'
import {
  bacaAtur,
  kembalikan,
  kirimGithub,
  muatRiwayat,
  PESAN_LURING,
  ringkasTerbit,
  siapTerbit,
  tanggalIndonesia,
  terbitkan,
  type RiwayatTerbit,
} from '../lib/terbit'

export function TerbitkanAnggota({ susun }: { susun: () => ShareBundle }) {
  const toast = useToast()
  const atur = bacaAtur()
  const [sedang, setSedang] = useState(false)
  const [riwayat, setRiwayat] = useState<RiwayatTerbit[]>([])
  const [siapPulih, setSiapPulih] = useState<string | null>(null)
  const [luring, setLuring] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false)
  const ringkas = ringkasTerbit(susun())
  const nama = susun().members ?? []

  useEffect(() => {
    const naik = () => setLuring(false)
    const turun = () => setLuring(true)
    window.addEventListener('online', naik)
    window.addEventListener('offline', turun)
    return () => {
      window.removeEventListener('online', naik)
      window.removeEventListener('offline', turun)
    }
  }, [])

  useEffect(() => {
    if (!atur || luring) return
    let batal = false
    muatRiwayat(atur, kirimGithub)
      .then((h) => {
        if (batal || 'salah' in h) return
        setRiwayat(h)
      })
      .catch(() => {})
    return () => {
      batal = true
    }
  }, [atur?.pemilik, atur?.repo, atur?.token, luring])

  async function jalankan() {
    if (!atur) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast.push(PESAN_LURING, 'err')
      return
    }
    setSedang(true)
    try {
      const hasil = await terbitkan(atur, siapTerbit(susun()), kirimGithub)
      toast.push(hasil.pesan, hasil.ok ? 'ok' : 'err')
      if (hasil.ok) {
        const h = await muatRiwayat(atur, kirimGithub)
        if (!('salah' in h)) setRiwayat(h)
      }
    } catch (e) {
      toast.push(e instanceof Error ? e.message : PESAN_LURING, 'err')
    } finally {
      setSedang(false)
    }
  }

  async function pulihkan(sha: string) {
    if (!atur) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast.push(PESAN_LURING, 'err')
      return
    }
    setSedang(true)
    try {
      const hasil = await kembalikan(atur, sha, kirimGithub)
      toast.push(hasil.ok ? 'Terbitan lama dipasang kembali. Riwayat GitHub tidak dihapus.' : hasil.pesan, hasil.ok ? 'ok' : 'err')
      if (hasil.ok) {
        const h = await muatRiwayat(atur, kirimGithub)
        if (!('salah' in h)) setRiwayat(h)
      }
    } catch (e) {
      toast.push(e instanceof Error ? e.message : PESAN_LURING, 'err')
    } finally {
      setSedang(false)
    }
  }

  const tanpaKunci = nama.map((m) => namaDenganPanggilan(m))

  return (
    <Card className="lg:col-span-3" data-testid="kartu-terbitkan">
      <h2 className="text-sm font-semibold text-slate-200">Terbitkan ke anggota</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        Satu ketukan menulis materi grup ke situs. Isi yang terbit sama dengan berkas grup:
        jadwal, show, dan lagu. <b>Tanpa</b> absensi, catatan, telepon, atau token QR.
        Kunci pribadi per anggota belum ada — data pribadi belum ikut terbit.
      </p>

      <ul className="mt-3 grid gap-1 text-[11px] text-slate-300 sm:grid-cols-2" data-testid="pratinjau-terbit">
        <li>Jadwal: {ringkas.jadwal}</li>
        <li>Show: {ringkas.show}</li>
        <li>Lagu: {ringkas.lagu}</li>
        <li>Anggota terkunci: {ringkas.terkunci}</li>
      </ul>
      <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
        Belum punya kunci ({tanpaKunci.length}):{' '}
        {tanpaKunci.length === 0
          ? 'tidak ada anggota.'
          : `${tanpaKunci.slice(0, 8).join(', ')}${tanpaKunci.length > 8 ? `, dan ${tanpaKunci.length - 8} lainnya` : ''}.`}
      </p>

      {!atur ? (
        <p className="mt-3 text-[11px] text-slate-400">
          Token belum dipasang.{' '}
          <Link className="text-emerald-400 hover:underline" to="/pengaturan">
            Atur di Pengaturan → Terbitkan ke anggota
          </Link>
          . Sebelum itu, unduh berkas grup dan unggah manual.
        </p>
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            data-testid="tombol-terbitkan"
            disabled={sedang || luring}
            onClick={() => void jalankan()}
          >
            <IconUpload size={14} /> {sedang ? 'Menerbitkan…' : 'Terbitkan ke anggota'}
          </Button>
          <span className="text-[11px] text-slate-500">
            {atur.pemilik}/{atur.repo}
          </span>
        </div>
      )}
      {luring && (
        <p data-testid="terbit-luring" className="mt-2 text-[11px] leading-relaxed text-amber-200/90">
          {PESAN_LURING}
        </p>
      )}

      {riwayat.length > 0 && (
        <div className="mt-3" data-testid="riwayat-terbit">
          <p className="mb-1 text-[11px] font-medium text-slate-400">Riwayat terbitan</p>
          <ul className="space-y-1">
            {riwayat.map((r) => (
              <li key={r.sha} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-800 px-2 py-1.5 text-[11px]">
                <span className="text-slate-300">
                  {r.tanggal ? tanggalIndonesia(Date.parse(r.tanggal)) : '—'} · {r.pesan}
                </span>
                <Button
                  size="sm"
                  variant={siapPulih === r.sha ? 'danger' : 'ghost'}
                  disabled={sedang}
                  onClick={() => {
                    if (siapPulih === r.sha) void pulihkan(r.sha)
                    else setSiapPulih(r.sha)
                  }}
                >
                  {siapPulih === r.sha ? 'Yakin kembalikan' : 'Kembalikan'}
                </Button>
              </li>
            ))}
          </ul>
          <p className="mt-1 text-[11px] text-slate-600">
            Mengembalikan menulis isi lama sebagai terbitan baru. Riwayat di GitHub tidak dihapus.
          </p>
        </div>
      )}
    </Card>
  )
}
