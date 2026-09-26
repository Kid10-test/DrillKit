/**
 * Daftar anggota induk.
 *
 * Pelatih utama memegang daftarnya. Pelatih kedua mengambil berkas itu di
 * sini — bukan membuat anggota baru — lalu hanya mengisi panggilan.
 * Id di perangkat ini berganti menjadi id milik pelatih utama, supaya show
 * yang dikirim balik menempel ke orang yang sama.
 */

import { useRef, useState } from 'react'
import { db } from '../db/db'
import type { Member } from '../db/types'
import {
  anggotaDariBerkas,
  keputusanAwal,
  perluDitanya,
  rencanakanInduk,
  susunSaran,
  terapkanCocok,
  type KeputusanCocok,
  type SaranBaris,
} from '../lib/namaAnggota'
import { muatUntukGabung, simpanRencana } from '../lib/simpanAnggota'
import { readFileAsText } from '../lib/utils'
import { Button, Card, Modal, useToast } from './ui'
import { IconUpload } from './Icons'
import { PanelCocok } from './PanelCocok'

export function KartuDaftarInduk() {
  const toast = useToast()
  const inputRef = useRef<HTMLInputElement>(null)
  const [lokal, setLokal] = useState<Member[]>([])
  const [masuk, setMasuk] = useState<Member[]>([])
  const [jenis, setJenis] = useState('')
  const [saran, setSaran] = useState<SaranBaris[]>([])
  const [keputusan, setKeputusan] = useState<Record<string, KeputusanCocok>>({})
  const [terbuka, setTerbuka] = useState(false)
  const [sedang, setSedang] = useState(false)

  async function terima(file: File) {
    let data: unknown
    try {
      data = JSON.parse(await readFileAsText(file))
    } catch {
      toast.push('Berkas tidak bisa dibaca', 'err')
      return
    }
    const hasil = anggotaDariBerkas(data)
    if (!hasil.ok) {
      toast.push(hasil.alasan, 'err')
      return
    }
    const ada = await db.members.toArray()
    const baris = susunSaran(hasil.anggota, ada)
    setLokal(ada)
    setMasuk(hasil.anggota)
    setJenis(hasil.jenis)
    setSaran(baris)
    setKeputusan(keputusanAwal(baris))
    setTerbuka(true)
  }

  async function terapkan() {
    setSedang(true)
    try {
      const hasil = terapkanCocok({
        masuk,
        lokal,
        keputusan,
        arah: 'berkas',
      })
      const data = await muatUntukGabung()
      const rencana = rencanakanInduk({ hasil, ...data })
      await simpanRencana({
        anggotaTulis: hasil.anggotaTulis,
        anggotaHapus: hasil.anggotaHapus,
        ...rencana,
      })
      setTerbuka(false)
      const ganti = hasil.anggotaHapus.length
      toast.push(
        ganti
          ? `Daftar induk dipakai. ${ganti} anggota berganti id, panggilan lokal tetap.`
          : 'Daftar induk dipakai. Id sudah sama — panggilan lokal tetap.',
      )
    } catch {
      toast.push('Gagal memakai daftar induk — data tidak berubah', 'err')
    } finally {
      setSedang(false)
    }
  }

  return (
    <Card className="mb-4" >
      <h2 className="text-sm font-semibold text-slate-200">Daftar anggota induk</h2>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500" data-testid="petunjuk-induk">
        Pelatih utama memegang daftar anggota. Pelatih kedua mengambil berkas show, data, atau
        backup dari pelatih utama di sini, lalu <b>hanya mengisi nama panggilan</b>. Id di
        perangkat ini diseragamkan dengan id pelatih utama, supaya posisi drill dan absensi
        menempel ke orang yang sama di kedua perangkat. Drill yang sudah ada di sini tidak
        ditimpa — yang berubah hanya identitas anggotanya.
      </p>
      <div className="mt-3">
        <Button size="sm" data-testid="ambil-induk" onClick={() => inputRef.current?.click()}>
          <IconUpload size={14} /> Ambil daftar induk
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="application/json,.json"
          data-testid="berkas-induk"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) void terima(f)
            e.target.value = ''
          }}
        />
      </div>

      <Modal
        open={terbuka}
        onClose={() => setTerbuka(false)}
        title="Cocokkan dengan daftar induk"
        wide
        testId="modal-induk"
        footer={
          <>
            <Button variant="ghost" onClick={() => setTerbuka(false)}>
              Batal
            </Button>
            <Button variant="primary" data-testid="terapkan-induk" disabled={sedang} onClick={() => void terapkan()}>
              {sedang ? 'Menyelaraskan…' : perluDitanya(saran, lokal.length) ? 'Selaraskan id' : 'Pakai daftar ini'}
            </Button>
          </>
        }
      >
        <p className="mb-3 text-[11px] text-slate-500">
          Berkas {jenis || 'DrillKit'} berisi {masuk.length} anggota. Yang cocok akan{' '}
          <b>berganti id</b> menjadi id di berkas. Panggilan yang sudah diisi di perangkat ini
          tidak ditimpa. Anggota di berkas yang tidak kamu cocokkan ditambahkan.
        </p>
        <PanelCocok
          saran={saran}
          lokal={lokal}
          keputusan={keputusan}
          onUbah={(id, kep) => setKeputusan((s) => ({ ...s, [id]: kep }))}
          pengantar="Pilih siapa di perangkat ini yang sama dengan anggota di daftar induk. Id lokal akan diganti."
        />
      </Modal>
    </Card>
  )
}
