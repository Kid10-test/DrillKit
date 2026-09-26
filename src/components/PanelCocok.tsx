/**
 * Layar "Cocokkan anggota".
 *
 * Dipakai sebelum show, data pilihan, atau backup menulis anggota yang
 * id-nya belum dikenal. Tiap baris: sama dengan anggota yang sudah ada,
 * atau anggota baru. Yang sudah dikenali lewat id atau alias tidak ditanya
 * lagi — itulah gunanya pencocokan diingat.
 */

import type { Member } from '../db/types'
import type { KeputusanCocok, SaranBaris } from '../lib/namaAnggota'
import { namaDenganPanggilan } from '../lib/namaAnggota'
import { Field, Select } from './ui'

export function PanelCocok({
  saran,
  lokal,
  keputusan,
  onUbah,
  pengantar,
}: {
  saran: SaranBaris[]
  lokal: Member[]
  keputusan: Record<string, KeputusanCocok>
  onUbah: (idMasuk: string, kep: KeputusanCocok) => void
  pengantar?: string
}) {
  const tanya = saran.filter((s) => !s.otomatis)
  const kenal = saran.length - tanya.length
  const olehId = new Map(lokal.map((m) => [m.id, m]))

  return (
    <div data-testid="panel-cocok" className="space-y-3">
      <p className="text-[11px] leading-relaxed text-slate-400">
        {pengantar ??
          'Anggota yang belum dikenal tidak langsung ditambahkan. Cocokkan ke orang yang sudah ada, atau biarkan sebagai anggota baru.'}
      </p>
      {kenal > 0 && (
        <p className="text-[11px] text-emerald-300/90" data-testid="cocok-dikenali">
          {kenal} anggota sudah dikenali (id atau alias) — tidak ditanya lagi.
        </p>
      )}
      {tanya.length === 0 ? (
        <p className="text-xs text-slate-500">Tidak ada yang perlu dicocokkan.</p>
      ) : (
        <ul className="space-y-2">
          {tanya.map((b) => {
            const kep = keputusan[b.masuk.id]
            const nilai = kep?.jenis === 'sama' ? kep.idLokal : 'baru'
            const sudahDiambil =
              nilai !== 'baru' &&
              tanya.some((lain) => {
                if (lain.masuk.id === b.masuk.id) return false
                const lainKep = keputusan[lain.masuk.id]
                return lainKep?.jenis === 'sama' && lainKep.idLokal === nilai
              })
            const skor = new Map(b.saran.map((s) => [s.idLokal, s]))
            const urut = [...lokal].sort((a, c) => (skor.get(c.id)?.skor ?? 0) - (skor.get(a.id)?.skor ?? 0) || a.name.localeCompare(c.name, 'id'))
            const alasan = b.saran[0]?.alasan.join(', ')
            return (
              <li
                key={b.masuk.id}
                data-testid={`cocok-baris-${b.masuk.id}`}
                className="rounded-lg border border-slate-800 bg-slate-950/40 p-2.5"
              >
                <p className="text-sm text-slate-100">
                  <span className="font-medium">{b.masuk.name || 'Tanpa nama'}</span>
                  {b.masuk.panggilan ? <span className="text-slate-400"> ({b.masuk.panggilan})</span> : null}
                  <span className="ml-1.5 text-[11px] text-slate-500">
                    {b.masuk.code || '—'}
                    {b.masuk.section ? ` · ${b.masuk.section}` : ''}
                    {b.masuk.instrument ? ` · ${b.masuk.instrument}` : ''}
                  </span>
                </p>
                <Field label="Cocokkan dengan">
                  <Select
                    data-testid={`cocok-pilih-${b.masuk.id}`}
                    value={nilai}
                    onChange={(e) => {
                      const v = e.target.value
                      onUbah(b.masuk.id, v === 'baru' ? { jenis: 'baru' } : { jenis: 'sama', idLokal: v })
                    }}
                  >
                    <option value="baru">Anggota baru</option>
                    {urut.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.code} — {namaDenganPanggilan(m)}
                        {skor.has(m.id) ? ' · saran' : ''}
                      </option>
                    ))}
                  </Select>
                </Field>
                {alasan && nilai !== 'baru' && olehId.get(nilai) && (
                  <p className="mt-1 text-[11px] text-amber-200/80">Saran: {alasan}.</p>
                )}
                {alasan && nilai === 'baru' && (
                  <p className="mt-1 text-[11px] text-slate-500">
                    Ada yang mirip ({alasan}), tetapi belum dipilih — akan masuk sebagai anggota baru.
                  </p>
                )}
                {sudahDiambil && (
                  <p className="mt-1 text-[11px] text-rose-300/90">
                    Anggota ini sudah dipilih di baris lain. Yang pertama menang; baris ini masuk sebagai anggota baru.
                  </p>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
