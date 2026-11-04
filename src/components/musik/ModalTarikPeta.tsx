/**
 * #27 — Modal "Tarik Peta Birama, Sukat, Tempo, Repeat/Volta, & Huruf Latihan
 * dari Partitur".
 *
 * Satu klik membaca MusicXML lagu (termasuk hasil konversi `.mscz`/`.mscx`)
 * lewat `petaPartitur.ts` (dimuat malas), menampilkan **pratinjau** baris
 * tempo map, lalu baru menulis ke `Song` setelah pelatih menekan Simpan —
 * prinsip "pratinjau dulu, tulis kemudian" yang sama dengan impor #10.
 *
 * Menggantikan kerja ketik ulang BPM/sukat/segmen di editor lagu (Matriks 3B
 * #7): editor manual tetap ada untuk lagu tanpa partitur atau koreksi kecil.
 */
import { useEffect, useState } from 'react'
import type { Song, TempoSegment } from '../../db/types'
import type { HasilTarikPeta } from '../../lib/petaPartitur'
import { muatPartiturBerkas } from '../../lib/partiturSimpan'
import { teksPartitur } from '../../lib/partitur'
import { uid } from '../../lib/utils'
import { Button, Modal } from '../ui'

export interface TambalanPeta {
  tempoMap: TempoSegment[]
  bpm: number
  beats: number
  tandaBirama: NonNullable<Song['tandaBirama']>
  panjangBirama: number
}

export function ModalTarikPeta({
  song,
  open,
  onClose,
  onSimpan,
}: {
  song: Song
  open: boolean
  onClose: () => void
  onSimpan: (songId: string, tambalan: TambalanPeta) => Promise<void>
}) {
  const [xml, setXml] = useState<string | null>(null)
  const [bentang, setBentang] = useState(false)
  const [hasil, setHasil] = useState<HasilTarikPeta | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [sibuk, setSibuk] = useState(false)

  // Baca berkas sekali tiap modal dibuka.
  useEffect(() => {
    if (!open) return
    let hidup = true
    setXml(null)
    setHasil(null)
    setGalat(null)
    void muatPartiturBerkas(song.id).then(async (item) => {
      if (!hidup) return
      if (!item?.blob || item.tipe !== 'musicxml') {
        setGalat('Berkas MusicXML lagu ini belum ada di perangkat ini — pasang partiturnya dulu.')
        return
      }
      const bita = new Uint8Array(await item.blob.arrayBuffer())
      if (hidup) setXml(teksPartitur(bita))
    })
    return () => {
      hidup = false
    }
  }, [open, song.id])

  // Tarik ulang tiap opsi berubah.
  useEffect(() => {
    if (!xml) return
    let hidup = true
    void import('../../lib/petaPartitur').then(({ tarikPetaPartitur }) => {
      if (!hidup) return
      const r = tarikPetaPartitur(xml, { bentangkanUlang: bentang, bpmCadangan: song.bpm || 120 })
      if (r.ok) {
        setHasil(r)
        setGalat(null)
      } else {
        setHasil(null)
        setGalat(r.alasan)
      }
    })
    return () => {
      hidup = false
    }
  }, [xml, bentang, song.bpm])

  async function simpan() {
    if (!hasil) return
    setSibuk(true)
    try {
      await onSimpan(song.id, {
        tempoMap: hasil.segmen.map((s) => ({ ...s, id: uid() })),
        bpm: hasil.bpmAwal,
        beats: hasil.tandaBiramaAwal.pembilang,
        tandaBirama: hasil.tandaBiramaAwal,
        panjangBirama: hasil.panjangBirama,
      })
      onClose()
    } finally {
      setSibuk(false)
    }
  }

  const lama = song.tempoMap?.length ?? 0

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Tarik peta tempo dari partitur"
      wide
      testId="modal-tarik-peta"
      footer={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onClose} data-testid="tarik-peta-batal">
            Batal
          </Button>
          <Button
            variant="primary"
            size="sm"
            disabled={!hasil || sibuk}
            data-testid="tarik-peta-simpan"
            onClick={() => void simpan()}
          >
            {lama > 0 ? `Ganti ${lama} segmen lama & simpan` : 'Simpan ke tempo map'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 text-xs">
        <p className="text-[11px] leading-relaxed text-slate-400">
          Huruf latihan, sukat, tempo (termasuk luncuran <i>rit./accel.</i>), serta tanda ulang & volta dibaca dari
          partitur <b>{song.partitur?.namaFile ?? song.title}</b>. Periksa dulu barisnya — belum ada yang disimpan.
        </p>

        {galat && (
          <p data-testid="tarik-peta-galat" className="rounded-lg border border-amber-600/40 bg-amber-950/20 p-2.5 text-amber-100/90">
            {galat}
          </p>
        )}

        {!hasil && !galat && <p className="text-slate-500">Membaca partitur…</p>}

        {hasil && (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-300" data-testid="tarik-peta-ringkas">
              <span>
                Awal: <b>{hasil.tandaBiramaAwal.pembilang}/{hasil.tandaBiramaAwal.penyebut}</b> ·{' '}
                <b>{hasil.bpmAwal} BPM</b>
              </span>
              <span>
                Panjang: <b data-testid="tarik-peta-panjang">{hasil.panjangBirama}</b> birama
                {hasil.dibentangkan ? ` (partitur ${hasil.jumlahBiramaPartitur}, ulangan dibentangkan)` : ''}
              </span>
              <span>{hasil.segmen.length} segmen</span>
            </div>

            {hasil.ulangan.length > 0 && (
              <label className="flex min-w-0 items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/50 p-2.5 text-[11px] text-slate-300">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={bentang}
                  data-testid="tarik-peta-bentang"
                  onChange={(e) => setBentang(e.target.checked)}
                />
                <span className="min-w-0">
                  <b>Bentangkan ulangan jadi urutan main</b> — metronom & drill menghitung birama sesuai urutan dimainkan (
                  {hasil.ulangan
                    .map(
                      (u) =>
                        `‖: ${u.dari}–${u.sampai} :‖ ×${u.kali}${u.volta.length ? ` · ${u.volta.map((v) => `volta ${v.nomor}: ${v.dari}–${v.sampai}`).join(', ')}` : ''}`,
                    )
                    .join('; ')}
                  ). Biarkan mati bila nomor birama harus sama dengan nomor di partitur (sorot partitur ikut nomor partitur).
                </span>
              </label>
            )}

            <div className="max-h-[50vh] overflow-auto rounded-lg border border-slate-800">
              <table className="w-full min-w-[420px] text-left text-[11px]" data-testid="tarik-peta-tabel">
                <thead className="sticky top-0 bg-slate-900 text-slate-400">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">Birama</th>
                    <th className="px-2 py-1.5 font-medium">Label</th>
                    <th className="px-2 py-1.5 font-medium">Sukat</th>
                    <th className="px-2 py-1.5 font-medium">BPM</th>
                    <th className="px-2 py-1.5 font-medium">Catatan</th>
                  </tr>
                </thead>
                <tbody>
                  {hasil.segmen.map((s, i) => (
                    <tr key={i} className="border-t border-slate-800 text-slate-200" data-testid="tarik-peta-baris">
                      <td className="px-2 py-1 tabular-nums">
                        {s.measure}
                        {s.beat && s.beat > 1 ? `:${s.beat}` : ''}
                      </td>
                      <td className="px-2 py-1 font-semibold">{s.label}</td>
                      <td className="px-2 py-1 tabular-nums">
                        {s.birama ? `${s.birama.pembilang}/${s.birama.penyebut}` : '—'}
                      </td>
                      <td className="px-2 py-1 tabular-nums text-emerald-300">
                        {s.rampCounts ? `↝ ${s.bpm}` : s.bpm}
                      </td>
                      <td className="px-2 py-1 text-slate-400">{s.note ?? ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {hasil.peringatan.length > 0 && (
              <ul data-testid="tarik-peta-peringatan" className="list-disc space-y-1 pl-4 text-[11px] text-amber-200/90">
                {hasil.peringatan.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            )}
            {lama > 0 && (
              <p className="text-[11px] text-slate-500">
                Tempo map lama ({lama} segmen) akan diganti seluruhnya. BPM awal, sukat lagu, dan panjang lagu ikut
                diperbarui.
              </p>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}
