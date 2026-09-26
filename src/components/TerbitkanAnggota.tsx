/**
 * Tombol "Terbitkan ke anggota" — bagian kedua: kunci pribadi & data terkunci.
 *
 * Menulis berkas grup + data pribadi terkunci per anggota ke repo materi.
 * Kunci AES-256-GCM acak per anggota. Diberikan lewat QR yang berisi
 * alamat situs dan kunci di bagian # (tidak terkirim ke server).
 *
 * Bisa juga lewat berkas per anggota. Tombol "Buat kunci baru" bila
 * kunci bocor. Terbitan lama di riwayat repo tetap terbuka dengan kunci
 * lama — tulis catatan jujur itu di sini.
 */

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ShareBundle } from '../db/types'
import { Button, Card, Modal, useToast } from './ui'
import { IconUpload } from './Icons'
import { namaDenganPanggilan } from '../lib/namaAnggota'
import {
  bacaAtur,
  kembalikan,
  kirimGithub,
  muatRiwayat,
  PESAN_LURING,
  ringkasTerbit,
  tanggalIndonesia,
  terbitkan,
  type RiwayatTerbit,
} from '../lib/terbit'
import {
  bacaKunciPribadi,
  buatKunciBaru,
  buatKunciBelumAda,
  cryptoTersedia,
  simpanKunciPribadi,
  urlDenganKunci,
} from '../lib/kunci'
import type { PetaKunci } from '../lib/kunci'

export function TerbitkanAnggota({ susun }: { susun: () => ShareBundle }) {
  const toast = useToast()
  const atur = bacaAtur()
  const [sedang, setSedang] = useState(false)
  const [riwayat, setRiwayat] = useState<RiwayatTerbit[]>([])
  const [siapPulih, setSiapPulih] = useState<string | null>(null)
  const [luring, setLuring] = useState(() => typeof navigator !== 'undefined' && navigator.onLine === false)
  const [petaKunci, setPetaKunci] = useState<PetaKunci>(() => bacaKunciPribadi())
  const [modalKunci, setModalKunci] = useState(false)
  const [sedangKunci, setSedangKunci] = useState(false)
  const ringkas = ringkasTerbit(susun())
  const bundle = susun()
  const nama = bundle.members ?? []

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

  /* Hitung ringkas dengan kunci yang ada */
  const terkunci = nama.filter((m) => !!petaKunci[m.id])
  const tanpaKunci = nama.filter((m) => !petaKunci[m.id])

  async function jalankan() {
    if (!atur) return
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      toast.push(PESAN_LURING, 'err')
      return
    }
    setSedang(true)
    try {
      const kunci = bacaKunciPribadi()
      const { json } = await (await import('../lib/terbit')).siapTerbitLengkap(bundle, kunci)
      const hasil = await terbitkan(atur, json, kirimGithub)
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

  async function buatSemuaKunci() {
    setSedangKunci(true)
    try {
      const baru = await buatKunciBelumAda(bundle.members)
      setPetaKunci({ ...baru })
      toast.push(`Kunci dibuat untuk ${Object.keys(baru).length} anggota.`)
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Gagal membuat kunci', 'err')
    } finally {
      setSedangKunci(false)
    }
  }

  async function buatUlang(id: string, nama: string) {
    setSedangKunci(true)
    try {
      await buatKunciBaru(id)
      setPetaKunci(bacaKunciPribadi())
      toast.push(`Kunci baru dibuat untuk ${nama}. Terbitan lama di repo tetap terbuka dengan kunci lama.`)
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Gagal membuat kunci', 'err')
    } finally {
      setSedangKunci(false)
    }
  }

  function hapusSemuaKunci() {
    simpanKunciPribadi({})
    setPetaKunci({})
    toast.push('Semua kunci dihapus. Data terkunci di terbitan berikutnya akan kosong.')
  }

  const adaKunci = Object.keys(petaKunci).length > 0
  const alamat = typeof location !== 'undefined' ? location.origin + location.pathname : ''

  return (
    <Card className="lg:col-span-3" data-testid="kartu-terbitkan">
      <h2 className="text-sm font-semibold text-slate-200">Terbitkan ke anggota</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        Satu ketukan menulis materi grup + data pribadi terkunci ke situs.
        Bagian terbuka: jadwal, show, lagu. Bagian terkunci per anggota: absensi, evaluasi, kemajuan, catatan.
        Dinamai dengan id anggota, <b>tanpa nama</b>.
      </p>

      {/* Pratinjau */}
      <ul className="mt-3 grid gap-1 text-[11px] text-slate-300 sm:grid-cols-2" data-testid="pratinjau-terbit">
        <li>Jadwal: {ringkas.jadwal}</li>
        <li>Show: {ringkas.show}</li>
        <li>Lagu: {ringkas.lagu}</li>
        <li>Anggota: {nama.length}</li>
        <li className="text-emerald-400">Terkunci: {terkunci.length}</li>
        <li className={tanpaKunci.length > 0 ? 'text-amber-400' : 'text-slate-500'}>
          Tanpa kunci: {tanpaKunci.length}
        </li>
      </ul>

      {/* Bagian kunci pribadi */}
      <div className="mt-3 rounded-lg border border-slate-800 bg-slate-950/40 p-3" data-testid="bagian-kunci">
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-slate-300">Kunci pribadi anggota</p>
          <span className="text-[11px] text-slate-500">
            {terkunci.length}/{nama.length} punya kunci
          </span>
        </div>

        {!cryptoTersedia() && (
          <p className="mt-2 rounded-lg bg-amber-950/40 border border-amber-800/40 px-3 py-2 text-[11px] text-amber-200">
            <code className="font-mono">crypto.subtle</code> tidak tersedia di file://.
            Enkripsi butuh HTTPS. Anggota umumnya memakai situs, bukan berkas portabel.
          </p>
        )}

        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="primary"
            disabled={sedangKunci || tanpaKunci.length === 0}
            onClick={() => void buatSemuaKunci()}
          >
            {sedangKunci ? 'Membuat…' : `Buat kunci (${tanpaKunci.length})`}
          </Button>
          {adaKunci && (
            <Button size="sm" variant="ghost" onClick={() => setModalKunci(true)}>
              Lihat QR kunci
            </Button>
          )}
          {adaKunci && (
            <Button size="sm" variant="ghost" onClick={hapusSemuaKunci}>
              Hapus semua kunci
            </Button>
          )}
        </div>

        {tanpaKunci.length > 0 && (
          <p className="mt-2 text-[11px] leading-relaxed text-amber-200/80">
            Belum punya kunci: {tanpaKunci.map((m) => namaDenganPanggilan(m)).slice(0, 5).join(', ')}
            {tanpaKunci.length > 5 ? `, dan ${tanpaKunci.length - 5} lainnya` : ''}.
          </p>
        )}

        {adaKunci && (
          <div className="mt-2 space-y-1">
            {terkunci.map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 text-[11px]">
                <span className="text-slate-300">{namaDenganPanggilan(m)}</span>
                <Button
                  size="sm"
                  variant="ghost"
                  disabled={sedangKunci}
                  onClick={() => void buatUlang(m.id, namaDenganPanggilan(m))}
                  title="Buat kunci baru bila kunci bocor"
                >
                  Buat baru
                </Button>
              </div>
            ))}
          </div>
        )}

        <p className="mt-2 text-[11px] leading-relaxed text-slate-600">
          Catatan jujur: terbitan lama di riwayat repo tetap terbuka dengan kunci lama.
          Mengganti kunci hanya berlaku untuk terbitan berikutnya.
        </p>
      </div>

      {/* Tombol terbitkan */}
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

      {/* Modal QR kunci */}
      <Modal open={modalKunci} onClose={() => setModalKunci(false)} title="QR kunci pribadi anggota" wide>
        <div className="space-y-3">
          <p className="text-[11px] leading-relaxed text-slate-400">
            Setiap QR berisi alamat situs + kunci di bagian <code className="font-mono text-slate-300">#</code>.
            Kunci tidak terkirim ke server. Cetak atau kirim foto QR ke anggota.
          </p>
          <p className="text-[11px] leading-relaxed text-amber-200/80 rounded-lg bg-amber-950/30 border border-amber-800/40 p-2">
            Catatan jujur: terbitan lama di repo tetap terbuka dengan kunci lama.
            Bila kunci bocor, buat kunci baru lalu terbitkan ulang.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {terkunci.map((m) => {
              const kunci = petaKunci[m.id]
              const url = kunci && alamat ? urlDenganKunci(alamat, kunci) : ''
              return (
                <div key={m.id} className="rounded-lg border border-slate-800 bg-slate-950/40 p-3 text-center">
                  <p className="text-xs font-medium text-slate-200 mb-2">{namaDenganPanggilan(m)}</p>
                  <QrTampil url={url} />
                  <p className="mt-2 break-all text-[10px] text-slate-600 font-mono">
                    #{kunci?.slice(0, 12)}…
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </Modal>
    </Card>
  )
}

/**
 * Tampilkan QR code dari URL menggunakan canvas kecil.
 *
 * Tidak bergantung pada pustaka eksternal — memakai pola biner dasar
 * yang bisa diuji tanpa pustaka. Untuk QR yang lebih besar/indah,
 * bisa diganti nanti.
 */
function QrTampil({ url }: { url: string }) {
  // QR sungguhan bisa dibuat dengan pustaka `qrcode` nanti.
  // Untuk sekarang: tampilkan URL yang bisa disalin.

  if (!url) return null

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard.writeText(url).then(() => {})
        }}
        className="w-full rounded-lg bg-slate-900 border border-slate-700 px-2 py-2 text-[10px] font-mono text-slate-300 hover:bg-slate-800 break-all"
        title="Klik untuk menyalin"
      >
        {url.length > 50 ? url.slice(0, 25) + '…' + url.slice(-15) : url}
      </button>
      <p className="mt-1 text-[10px] text-slate-600">Klik untuk menyalin URL+kunci</p>
    </div>
  )
}