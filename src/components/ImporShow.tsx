/**
 * #7 — alur impor show (dipakai dua pintu).
 *
 * Dipindah dari `KartuBerbagiShow` tanpa mengubah perilaku: pratinjau isi
 * berkas → pilih cara (timpa/gabung/salinan) bila show-nya sudah ada →
 * cocokkan anggota yang belum dikenal → impor. Tombol impor show yang lama
 * (di pengaturan drill) dan pintu baru "Buka berkas DrillKit" memakai
 * komponen yang sama, sehingga alurnya tidak pernah berbeda.
 */
import { useEffect, useState } from 'react'
import { db } from '../db/db'
import type { Member } from '../db/types'
import { Button, Field, Select, useToast } from './ui'
import {
  LABEL_MODE,
  KETERANGAN_MODE,
  imporShow,
  ringkasBerkas,
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

export function AlurImporShow({
  data,
  onSelesai,
  testId = 'impor-show',
}: {
  data: BerkasShow
  /** Dipanggil setelah impor berhasil, membawa id drill hasilnya. */
  onSelesai?: (drillId: string) => void
  testId?: string
}) {
  const toast = useToast()
  const [mode, setMode] = useState<ModeImpor>('gabung')
  const [showAda, setShowAda] = useState(false)
  const [lokal, setLokal] = useState<Member[]>([])
  const [saran, setSaran] = useState<SaranBaris[]>([])
  const [keputusan, setKeputusan] = useState<Record<string, KeputusanCocok>>({})
  const [sedang, setSedang] = useState(false)
  const [siap, setSiap] = useState(false)

  useEffect(() => {
    let hidup = true
    ;(async () => {
      const ada = await db.members.toArray()
      const baris = susunSaran(data.members ?? [], ada)
      const sudahAda = await db.drills.get(data.drill.id)
      if (!hidup) return
      setLokal(ada)
      setSaran(baris)
      setKeputusan(keputusanAwal(baris))
      setShowAda(!!sudahAda)
      setSiap(true)
    })()
    return () => {
      hidup = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function jalankan() {
    setSedang(true)
    try {
      const hasil = terapkanCocok({
        masuk: data.members ?? [],
        lokal,
        keputusan,
        arah: 'lokal',
      })
      const { data: diubah, bentrok } = tulisUlangMuatan(data, hasil.peta)
      const idCocok = new Set(hasil.idSudahCocok)
      const idLokal = new Set(lokal.map((m) => m.id))
      // Anggota baru tetap di berkas: imporShow yang memberi token QR baru.
      const siapImpor: BerkasShow = {
        ...diubah,
        members: (diubah.members ?? []).filter((m) => !idCocok.has(m.id)),
      }
      await simpanAnggota(
        hasil.anggotaTulis.filter((m) => idLokal.has(m.id)),
        [],
      )
      const h = await imporShow(siapImpor, mode)
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

  const ringkas = ringkasBerkas(data)
  const tanya = siap && perluDitanya(saran, lokal.length)

  return (
    <div data-testid={testId}>
      <div className="rounded-lg bg-slate-950/50 p-3 text-xs text-slate-400">
        <p className="text-sm font-semibold text-slate-100">{ringkas.nama}</p>
        {ringkas.judul && <p className="text-[11px] text-slate-500">{ringkas.judul}</p>}
        <p className="mt-1.5">
          {ringkas.jumlahSet} set · {ringkas.jumlahAnggota} pemain di formasi · {ringkas.jumlahLagu} lagu
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
                data-testid={`${testId}-mode`}
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
      {tanya && (
        <div className="mt-3">
          <PanelCocok
            saran={saran}
            lokal={lokal}
            keputusan={keputusan}
            onUbah={(id, kep) => setKeputusan((s) => ({ ...s, [id]: kep }))}
          />
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button
          variant="primary"
          data-testid={`${testId}-proses`}
          disabled={sedang || !siap}
          onClick={() => void jalankan()}
        >
          {sedang ? 'Memproses…' : 'Impor sekarang'}
        </Button>
      </div>
    </div>
  )
}
