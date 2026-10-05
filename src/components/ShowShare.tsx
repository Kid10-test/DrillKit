/**
 * F3 — Berbagi show antar pelatih (dua arah).
 *
 * Dipasang di dalam **Pengaturan drill** (tombol ⚙ di editor): satu show bisa
 * diekspor jadi berkas `.json`, dikirim lewat WhatsApp/email, dibuka pelatih
 * lain di perangkatnya, disusun set-nya di sana, lalu dikirim balik dan
 * digabungkan lagi ke sini.
 *
 * Alurnya sengaja dibuat berhati-hati:
 * 1. Berkas dibaca & **diperiksa dulu** sebelum apa pun ditulis ke database.
 * 2. Kalau show dengan id yang sama sudah ada di perangkat ini, aplikasi
 *    **bertanya** lebih dulu mau ditimpa, digabung, atau disalin sebagai show
 *    baru — tidak ada data yang ditimpa tanpa pilihanmu.
 * 3. Anggota yang sudah ada **tidak pernah** ditimpa. Yang belum dikenal
 *    dicocokkan dulu; yang dipilih sebagai anggota baru mendapat token QR baru.
 */

import { useRef, useState } from 'react'
import { db } from '../db/db'
import type { Drill, Member } from '../db/types'
import { Button, Field, Modal, Select, useToast } from './ui'
import { IconDownload, IconUpload } from './Icons'
import { downloadFile } from '../lib/utils'
import { kenaliBerkas } from '../lib/bukaBerkas'
import { mintaPratinjau } from './BukaBerkas'
import {
  LABEL_MODE,
  KETERANGAN_MODE,
  cekBerkas,
  imporShow,
  namaBerkasShow,
  ringkasBerkas,
  susunBerkasShow,
} from '../lib/show'
import type { BerkasShow, ModeImpor } from '../lib/show'
import {
  keputusanAwal,
  perluDitanya,
  susunSaran,
  terapkanCocok,
  tulisUlangMuatan,
  type KeputusanCocok,
  type SaranBaris,
} from '../lib/namaAnggota'
import { simpanAnggota } from '../lib/simpanAnggota'
import { PanelCocok } from './PanelCocok'

export function KartuBerbagiShow({
  drill,
  namaTim,
  onSelesai,
}: {
  drill: Drill
  namaTim: string
  /** dipanggil setelah impor berhasil, membawa id drill hasilnya */
  onSelesai?: (drillId: string) => void
}) {
  const toast = useToast()
  const [mode, setMode] = useState<ModeImpor>('gabung')
  const [berkas, setBerkas] = useState<BerkasShow | null>(null)
  const [showAda, setShowAda] = useState(false)
  const [lokal, setLokal] = useState<Member[]>([])
  const [saran, setSaran] = useState<SaranBaris[]>([])
  const [keputusan, setKeputusan] = useState<Record<string, KeputusanCocok>>({})
  const [sedang, setSedang] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  async function ekspor() {
    const data = await susunBerkasShow(drill.id, namaTim)
    if (!data) {
      toast.push('Drill tidak ditemukan', 'err')
      return
    }
    downloadFile(namaBerkasShow(drill.name), JSON.stringify(data))
    toast.push(`Show "${drill.name}" diunduh — kirim ke pelatih lain`)
  }

  async function pilihBerkas(file: File | undefined) {
    if (!file) return
    // #7 — tombol lama menerima SEMUA jenis: yang bukan show dialihkan ke
    // pratinjau yang benar, bukan ditolak mentah-mentah.
    const bita = new Uint8Array(await file.arrayBuffer())
    const kenal = kenaliBerkas(file.name, bita)
    if (kenal.jenis !== 'show') {
      mintaPratinjau(kenal, bita)
      return
    }
    const data: unknown = kenal.data
    const salah = cekBerkas(data)
    if (salah) {
      toast.push(salah, 'err')
      return
    }
    const sah = data as BerkasShow
    const ada = await db.members.toArray()
    const baris = susunSaran(sah.members ?? [], ada)
    const sudahAda = await db.drills.get(sah.drill.id)
    const tanya = perluDitanya(baris, ada.length)
    if (!sudahAda && !tanya) {
      await jalankan(sah, 'gabung', ada, keputusanAwal(baris))
      return
    }
    setLokal(ada)
    setSaran(baris)
    setKeputusan(keputusanAwal(baris))
    setShowAda(!!sudahAda)
    setBerkas(sah)
    setMode('gabung')
  }

  async function jalankan(
    data: BerkasShow,
    modeDipakai: ModeImpor,
    anggotaLokal: Member[] = lokal,
    kep: Record<string, KeputusanCocok> = keputusan,
  ) {
    setSedang(true)
    try {
      const hasil = terapkanCocok({
        masuk: data.members ?? [],
        lokal: anggotaLokal,
        keputusan: kep,
        arah: 'lokal',
      })
      const { data: diubah, bentrok } = tulisUlangMuatan(data, hasil.peta)
      const idCocok = new Set(hasil.idSudahCocok)
      const idLokal = new Set(anggotaLokal.map((m) => m.id))
      // Anggota baru tetap di berkas: imporShow yang memberi token QR baru.
      const siap: BerkasShow = {
        ...diubah,
        members: (diubah.members ?? []).filter((m) => !idCocok.has(m.id)),
      }
      await simpanAnggota(
        hasil.anggotaTulis.filter((m) => idLokal.has(m.id)),
        [],
      )
      const h = await imporShow(siap, modeDipakai)
      setBerkas(null)
      const catatan = hasil.laporan.length + bentrok.length
      toast.push(
        `Show "${h.nama}" masuk · ${h.setDitulis} set` +
          (h.setDihapus ? ` · ${h.setDihapus} set lama diganti` : '') +
          (h.anggotaBaru ? ` · ${h.anggotaBaru} anggota baru` : '') +
          (catatan ? ` · ${catatan} catatan pencocokan` : '') +
          (h.laguBaru ? ` · ${h.laguBaru} lagu baru` : ''),
      )
      onSelesai?.(h.drillId)
    } catch (e) {
      toast.push(e instanceof Error ? e.message : 'Gagal mengimpor show', 'err')
    } finally {
      setSedang(false)
    }
  }

  const ringkas = berkas ? ringkasBerkas(berkas) : null

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3" data-testid="kartu-berbagi-show">
      <p className="text-xs font-semibold text-slate-300">Berbagi show dengan pelatih lain</p>
      <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
        Ekspor show ini jadi berkas <b>.json</b>, kirim ke pelatih lain, lalu ia bisa membukanya,
        menyusun set-nya sendiri, dan mengirim balik berkasnya untuk digabung ke sini. Anggota &
        lagu yang sudah ada di perangkat tujuan <b>tidak akan ditimpa</b>. Anggota yang belum
        dikenal dicocokkan dulu, tidak langsung ditambahkan. Token QR absensi tidak
        ikut dalam berkas.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <Button size="sm" data-testid="tombol-ekspor-show" onClick={ekspor}>
          <IconDownload size={14} /> Ekspor show
        </Button>
        <Button size="sm" variant="ghost" data-testid="tombol-impor-show" onClick={() => inputRef.current?.click()}>
          <IconUpload size={14} /> Impor show
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept=".json,.csv,.zip,application/json,text/csv,application/zip"
          data-testid="berkas-show"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0]
            void pilihBerkas(f)
            // kosongkan supaya berkas yang sama bisa dipilih ulang
            e.target.value = ''
          }}
        />
      </div>

      <Modal
        open={!!berkas}
        onClose={() => setBerkas(null)}
        title="Impor show"
        wide={perluDitanya(saran, lokal.length)}
        footer={
          <>
            <Button variant="ghost" onClick={() => setBerkas(null)}>
              Batal
            </Button>
            <Button
              variant="primary"
              data-testid="tombol-proses-impor"
              disabled={sedang}
              onClick={() => berkas && jalankan(berkas, mode)}
            >
              {sedang ? 'Memproses…' : 'Impor sekarang'}
            </Button>
          </>
        }
      >
        {ringkas && (
          <>
            <div className="rounded-lg bg-slate-950/50 p-3 text-xs text-slate-400">
              <p className="text-sm font-semibold text-slate-100">{ringkas.nama}</p>
              {ringkas.judul && <p className="text-[11px] text-slate-500">{ringkas.judul}</p>}
              <p className="mt-1.5">
                {ringkas.jumlahSet} set · {ringkas.jumlahAnggota} pemain di formasi ·{' '}
                {ringkas.jumlahLagu} lagu
              </p>
              <p className="text-[11px] text-slate-500">
                dari <b>{ringkas.tim}</b> · dibuat{' '}
                {new Date(ringkas.dibuat).toLocaleDateString('id-ID', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </p>
            </div>
            {showAda && (
              <>
                <p className="mt-3 text-[11px] text-amber-200">
                  Show dengan id yang sama sudah ada di perangkat ini. Pilih caranya:
                </p>
                <div className="mt-2">
                  <Field label="Cara mengimpor">
                    <Select
                      data-testid="pilih-mode-impor"
                      value={mode}
                      onChange={(e) => setMode(e.target.value as ModeImpor)}
                    >
                      {(['ganti', 'gabung', 'salinan'] as ModeImpor[]).map((m) => (
                        <option key={m} value={m}>
                          {LABEL_MODE[m]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
                    {KETERANGAN_MODE[mode]}
                  </p>
                </div>
              </>
            )}
            {perluDitanya(saran, lokal.length) && (
              <div className="mt-3">
                <PanelCocok
                  saran={saran}
                  lokal={lokal}
                  keputusan={keputusan}
                  onUbah={(id, kep) => setKeputusan((s) => ({ ...s, [id]: kep }))}
                />
              </div>
            )}
          </>
        )}
      </Modal>
    </div>
  )
}
