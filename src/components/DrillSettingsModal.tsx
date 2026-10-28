/**
 * Diekstrak dari `src/pages/Drill.tsx` (#5 — pecah Drill.tsx).
 * Isinya tidak diubah; hanya alamat impor yang disesuaikan.
 */

/** Pengaturan satu drill (lapangan, tempo, berbagi show). */
import { useEffect, useState } from 'react'
import { db } from '../db/db'
import type {
  DasarJarak,
  Drill,
  ModeLangkah,
  SetelanLangkah,
} from '../db/types'
import {
  Button,
  Field,
  Input,
  Modal,
} from './ui'

import {
  FIELD_PRESETS,
  activePreset,
} from '../lib/field'
import { KartuBerbagiShow } from './ShowShare'
import { FieldConfigEditor } from './FieldConfigEditor'

export function DrillSettingsModal({
  open,
  drill,
  onClose,
  rosterCount,
  namaTim,
  setDrillId,
}: {
  open: boolean
  drill: Drill
  onClose: () => void
  rosterCount: number
  /** F3 — nama tim, ikut ditulis ke dalam berkas show. */
  namaTim: string
  /** F3 — dipakai untuk pindah ke show hasil impor (kalau disalin sebagai show baru). */
  setDrillId: (id: string) => void
}) {
  const [d, setD] = useState<Drill>(drill)
  useEffect(() => setD(drill), [drill])
  /** DD10b — cara langkah dihitung untuk drill ini (bawaan untuk semua set). */
  const modeLangkah: ModeLangkah = d.setelanLangkah?.mode ?? 'tetap'
  const lpcTarget = d.setelanLangkah?.langkahPerCount ?? 1
  const setelLangkah = (sunting: Partial<SetelanLangkah>) =>
    setD({ ...d, setelanLangkah: { mode: modeLangkah, langkahPerCount: lpcTarget, ...sunting } })
  /** 31e — dasar jarak untuk drill ini. Kosong diperlakukan sebagai 'jalur'. */
  const dasarJarak: DasarJarak = d.setelanJarak ?? 'jalur'

  async function save() {
    await db.drills.put({ ...d, updatedAt: Date.now() })
    onClose()
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pengaturan drill"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Tutup
          </Button>
          <Button variant="primary" onClick={save}>
            Simpan
          </Button>
        </>
      }
    >
      <Field label="Nama drill">
        <Input value={d.name} onChange={(e) => setD({ ...d, name: e.target.value })} />
      </Field>
      <Field label="Judul show" hint="opsional">
        <Input value={d.showTitle} onChange={(e) => setD({ ...d, showTitle: e.target.value })} />
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tempo dasar (BPM)">
          <Input type="number" value={d.tempo} onChange={(e) => setD({ ...d, tempo: Number(e.target.value) })} />
        </Field>
        <Field label="Ketukan per count">
          <Input
            type="number"
            value={d.beatsPerCount}
            onChange={(e) => setD({ ...d, beatsPerCount: Math.max(1, Number(e.target.value)) })}
          />
        </Field>
      </div>

      {/* DD10b — cara menghitung langkah: ukuran tetap, atau mengikuti hitungan. */}
      <div className="rounded-lg border border-slate-800 bg-slate-950/40 p-3">
        <label className="mb-1.5 block text-xs font-medium text-slate-400">
          Cara menghitung langkah
        </label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          <Button
            size="sm"
            variant={modeLangkah === 'tetap' ? 'primary' : 'soft'}
            onClick={() => setelLangkah({ mode: 'tetap' })}
            title="Ukuran langkah dikunci 8-to-5 (22,5 inci). Jumlah langkah ditentukan jarak; yang menyesuaikan kecepatannya."
          >
            Ukuran langkah tetap
          </Button>
          <Button
            size="sm"
            variant={modeLangkah === 'menyesuaikan' ? 'primary' : 'soft'}
            onClick={() => setelLangkah({ mode: 'menyesuaikan' })}
            title="Jumlah langkah ditentukan hitungan, lalu ukuran langkahnya yang menyesuaikan."
          >
            Langkah ikut hitungan
          </Button>
        </div>
        {modeLangkah === 'menyesuaikan' && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Langkah tiap hitungan" hint="1 = satu langkah tiap hitungan">
              <Input
                type="number"
                step="0.5"
                min="0.5"
                value={lpcTarget}
                onChange={(e) =>
                  setelLangkah({ langkahPerCount: Math.max(0.5, Number(e.target.value) || 1) })
                }
              />
            </Field>
          </div>
        )}
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          {modeLangkah === 'tetap' ? (
            <>
              <b>Ukuran langkah tetap</b> — panjang langkah dikunci mengikuti patokan lapangan
              (bawaan 22,5&Prime;). Jumlah langkah ditentukan <b>jaraknya</b>, jadi jarak dekat
              dalam hitungan panjang berarti jalan pelan. Ini cara lama dan paling umum.
            </>
          ) : (
            <>
              <b>Langkah ikut hitungan</b> — jumlah langkah ditentukan{' '}
              <b>hitungannya</b> ({lpcTarget} langkah tiap hitungan), lalu{' '}
              <b>panjang langkahnya</b> yang mengecil atau membesar. Ritme pemain tetap sama,
              yang menyesuaikan ukuran langkahnya — cocok kalau jaraknya terlalu dekat untuk
              hitungan yang disediakan.
            </>
          )}
        </p>
      </div>

      {/* 31e — dasar jarak: jarak tempuh kaki, atau garis lurus. */}
      <div
        className="rounded-lg border border-slate-800 bg-slate-950/40 p-3"
        data-testid="setelan-jarak"
      >
        <label className="mb-1.5 block text-xs font-medium text-slate-400">
          Dasar jarak
        </label>
        <div className="mb-2 flex flex-wrap gap-1.5">
          <Button
            size="sm"
            data-testid="jarak-jalur"
            variant={dasarJarak === 'jalur' ? 'primary' : 'soft'}
            onClick={() => setD({ ...d, setelanJarak: 'jalur' })}
            title="Jarak tempuh kaki, mengikuti kelengkungan jalur"
          >
            Jarak tempuh
          </Button>
          <Button
            size="sm"
            data-testid="jarak-lurus"
            variant={dasarJarak === 'lurus' ? 'primary' : 'soft'}
            onClick={() => setD({ ...d, setelanJarak: 'lurus' })}
            title="Perpindahan dari titik awal ke akhir, abaikan kelengkungan"
          >
            Garis lurus
          </Button>
        </div>
        <p className="text-[11px] leading-relaxed text-slate-500">
          {dasarJarak === 'jalur' ? (
            <>
              <b>Jarak tempuh</b> — jarak yang benar-benar dilalui kaki, mengikuti
              kelengkungan jalur. Jalur melengkung membuatnya lebih panjang dari garis
              lurus walau titik awal &amp; akhirnya sama. Ini yang menentukan
              berapa langkah sungguhan yang diambil pemain.
            </>
          ) : (
            <>
              <b>Garis lurus</b> — perpindahan dari titik awal ke titik akhir,
              kelengkungan diabaikan. Cocok kalau Anda menghitung formasi secara
              geometris: &quot;delapan langkah dari sini ke sana&quot;.
            </>
          )}
        </p>
      </div>

      <div>
        <label className="mb-1.5 block text-xs font-medium text-slate-400">
          Lapangan drill ini
          <span className="ml-2 font-normal text-slate-500">
            {activePreset(d.field) ? FIELD_PRESETS.find((p) => p.id === activePreset(d.field))?.hint : 'ukuran khusus'}
          </span>
        </label>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {FIELD_PRESETS.map((p) => (
            <Button
              key={p.id}
              size="sm"
              variant={activePreset(d.field) === p.id ? 'primary' : 'soft'}
              onClick={() =>
                setD({
                  ...d,
                  field: {
                    ...d.field,
                    showLabels: 1,
                    gridTampil: 1,
                    subgridTampil: 0,
                    subgridYd: undefined,
                    hashTampil: p.config.hash && p.config.hash !== 'none' ? 1 : 0,
                    ...p.config,
                  },
                })
              }
              title={p.hint}
            >
              {p.label}
            </Button>
          ))}
        </div>
        <FieldConfigEditor value={d.field} onChange={(field) => setD({ ...d, field })} />
        <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
          Ukuran lapangan disimpan <b>per drill</b>, jadi tiap tahun/show bisa memakai standar
          yang berbeda tanpa mengubah drill lama.
        </p>
      </div>
      <div className="rounded-lg bg-slate-950/50 p-3 text-[11px] leading-relaxed text-slate-500">
        Durasi pindah antar set = count × (60 ÷ BPM) × ketukan per count. Contoh: 16 count pada 120 BPM dengan 1
        ketukan/count = 8 detik.
      </div>
      <p className="text-xs text-slate-400">Anggota dalam drill ini: {rosterCount} orang.</p>

      {/* F3 — berbagi show (dua arah) dengan pelatih lain */}
      <KartuBerbagiShow drill={drill} namaTim={namaTim} onSelesai={(id) => { if (id !== drill.id) setDrillId(id) }} />
    </Modal>
  )
}
