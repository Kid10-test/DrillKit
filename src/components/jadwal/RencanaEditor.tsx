/**
 * Penyunting rencana latihan (H1) — #35: ranah per blok, blok paralel per
 * seksi, komposisi & peringatan langsung, serta muat/simpan pola sesi.
 *
 * Durasi disimpan per blok (bukan jam absolut), jadi menggeser jam mulai
 * sesi otomatis menggeser seluruh blok tanpa perlu disusun ulang. Blok
 * paralel memakai durasi blok induknya, sehingga jam sesi tetap satu garis.
 */
import { useMemo, useState } from 'react'
import type { BlokLatihan, CabangBlok, JenisBlok, Session } from '../../db/types'
import { saveSettings } from '../../db/db'
import { Button, Input, Select, useToast } from '../ui'
import { LABEL_BLOK, URUTAN_BLOK, WARNA_BLOK, formatMenit, lebihRencana, totalRencana } from '../../lib/latihan'
import { lamaSlot, menitDariJam } from '../../lib/runsheet'
import {
  buatPola,
  komposisiRencana,
  labelKomposisi,
  periksaRencana,
  salinRencana,
  simpanPola,
  teksKomposisi,
} from '../../lib/ranahSesi'
import { uid } from '../../lib/utils'
import { useSettings } from '../../hooks/useSettings'
import { useSeksiAktif, type SeksiAktif } from '../../hooks/useSeksiAktif'
import { BilahKomposisi } from './BilahKomposisi'

const buatId = (awalan: string) => uid(awalan)

/** Penyunting daftar blok — dipakai modal jadwal dan penyunting pola. */
export function PenyuntingBlok({
  blok,
  onChange,
  slot,
  seksi,
}: {
  blok: BlokLatihan[]
  onChange: (b: BlokLatihan[]) => void
  /** Lama slot sesi dalam menit; `undefined` = bukan sesi (mis. pola). */
  slot?: number | null
  seksi: SeksiAktif[]
}) {
  const [judul, setJudul] = useState('')
  const [jenis, setJenis] = useState<JenisBlok>('pemanasan')
  const [menit, setMenit] = useState('15')
  const [buka, setBuka] = useState<string | null>(null)

  const ids = useMemo(() => seksi.map((s) => s.id), [seksi])
  const labelSeksi = (id: string) => seksi.find((s) => s.id === id)?.label ?? id
  const komp = useMemo(() => komposisiRencana(blok, ids), [blok, ids])
  const peringatan = useMemo(
    () => periksaRencana(blok, ids, (id) => seksi.find((s) => s.id === id)?.label ?? id),
    [blok, ids, seksi],
  )
  const lebih = slot === undefined ? undefined : lebihRencana(slot, blok)

  function tambah() {
    const n = Number(menit)
    if (!judul.trim() || !Number.isFinite(n) || n <= 0) return
    const b: BlokLatihan = { id: uid('b_'), judul: judul.trim(), jenis, menit: Math.round(n) }
    onChange([...blok, b])
    setJudul('')
  }

  const hapus = (id: string) => onChange(blok.filter((b) => b.id !== id))

  function geser(i: number, arah: -1 | 1) {
    const j = i + arah
    if (j < 0 || j >= blok.length) return
    const salin = [...blok]
    ;[salin[i], salin[j]] = [salin[j], salin[i]]
    onChange(salin)
  }

  const ubah = (id: string, patch: Partial<BlokLatihan>) =>
    onChange(
      blok.map((b) => {
        if (b.id !== id) return b
        const baru: BlokLatihan = { ...b, ...patch }
        for (const k of ['pelatih', 'tempat', 'catatan'] as const) if (baru[k] === '') delete baru[k]
        if (baru.cabang && baru.cabang.length === 0) delete baru.cabang
        return baru
      }),
    )

  const ubahCabang = (b: BlokLatihan, cid: string, patch: Partial<CabangBlok>) =>
    ubah(b.id, {
      cabang: (b.cabang ?? []).map((c) => {
        if (c.id !== cid) return c
        const baru: CabangBlok = { ...c, ...patch }
        if (!baru.jenis) delete baru.jenis
        if (baru.pelatih === '') delete baru.pelatih
        if (baru.tempat === '') delete baru.tempat
        return baru
      }),
    })

  function jadikanParalel(b: BlokLatihan) {
    ubah(b.id, {
      cabang: seksi.map((s) => ({ id: uid('j_'), seksi: [s.id], judul: b.judul })),
    })
  }

  function tambahCabang(b: BlokLatihan) {
    const terpakai = new Set((b.cabang ?? []).flatMap((c) => c.seksi))
    const sisa = ids.filter((id) => !terpakai.has(id))
    ubah(b.id, { cabang: [...(b.cabang ?? []), { id: uid('j_'), seksi: sisa.slice(0, 1), judul: '' }] })
  }

  return (
    <div>
      {blok.length > 0 && (
        <ul data-testid="daftar-blok" className="mb-2 space-y-1">
          {blok.map((b, i) => {
            const cabang = b.cabang ?? []
            const terbuka = buka === b.id
            return (
              <li key={b.id} data-testid={`blok-${b.id}`} className="rounded bg-slate-800/50 px-2 py-1.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-600">{i + 1}.</span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{b.judul}</span>
                  <span className={`shrink-0 rounded border px-1.5 py-0.5 text-[10px] ${WARNA_BLOK[b.jenis] ?? WARNA_BLOK.lainnya}`}>
                    {LABEL_BLOK[b.jenis] ?? b.jenis}
                  </span>
                  <span className="w-14 shrink-0 text-right text-xs text-slate-300">{b.menit} mnt</span>
                  <button
                    type="button"
                    onClick={() => setBuka(terbuka ? null : b.id)}
                    data-testid={`detail-${b.id}`}
                    aria-expanded={terbuka}
                    className={`shrink-0 rounded px-1 text-xs hover:bg-slate-700 ${
                      cabang.length ? 'text-cyan-300' : 'text-slate-500 hover:text-slate-200'
                    }`}
                    title="Detail, pelatih, tempat, & paralel per seksi"
                  >
                    {cabang.length ? `⇉${cabang.length}` : '⋯'}
                  </button>
                  <button
                    type="button"
                    onClick={() => geser(i, -1)}
                    disabled={i === 0}
                    data-testid={`naik-${b.id}`}
                    className="rounded px-1 text-slate-500 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-25"
                    title="Naikkan"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => geser(i, 1)}
                    disabled={i === blok.length - 1}
                    data-testid={`turun-${b.id}`}
                    className="rounded px-1 text-slate-500 hover:bg-slate-700 hover:text-slate-200 disabled:opacity-25"
                    title="Turunkan"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => hapus(b.id)}
                    data-testid={`hapus-${b.id}`}
                    className="rounded px-1 text-slate-500 hover:bg-slate-700 hover:text-rose-300"
                  >
                    ✕
                  </button>
                </div>

                {!terbuka && (cabang.length > 0 || b.pelatih || b.tempat) && (
                  <p className="mt-0.5 pl-5 text-[11px] text-slate-500">
                    {cabang.length > 0
                      ? cabang
                          .map((c) => `${c.seksi.map(labelSeksi).join('+') || '?'}: ${c.judul || '—'}${c.pelatih ? ` (${c.pelatih})` : ''}`)
                          .join(' · ')
                      : [b.pelatih, b.tempat].filter(Boolean).join(' · ')}
                  </p>
                )}

                {terbuka && (
                  <div data-testid={`panel-blok-${b.id}`} className="mt-2 space-y-2 border-t border-slate-700/60 pt-2">
                    <div className="grid gap-2 sm:grid-cols-[1fr_9rem_5rem]">
                      <Input
                        data-testid={`judul-${b.id}`}
                        value={b.judul}
                        onChange={(e) => ubah(b.id, { judul: e.target.value })}
                        placeholder="Judul blok"
                      />
                      <Select
                        data-testid={`ranah-${b.id}`}
                        value={b.jenis}
                        onChange={(e) => ubah(b.id, { jenis: e.target.value as JenisBlok })}
                      >
                        {URUTAN_BLOK.map((t) => (
                          <option key={t} value={t}>
                            {LABEL_BLOK[t]}
                          </option>
                        ))}
                      </Select>
                      <Input
                        data-testid={`menit-${b.id}`}
                        type="number"
                        min={1}
                        value={String(b.menit)}
                        onChange={(e) => {
                          const n = Math.round(Number(e.target.value))
                          if (Number.isFinite(n) && n > 0) ubah(b.id, { menit: n })
                        }}
                      />
                    </div>
                    {cabang.length === 0 && (
                      <div className="grid gap-2 sm:grid-cols-2">
                        <Input
                          data-testid={`pelatih-${b.id}`}
                          value={b.pelatih ?? ''}
                          onChange={(e) => ubah(b.id, { pelatih: e.target.value })}
                          placeholder="Pelatih (opsional)"
                        />
                        <Input
                          data-testid={`tempat-${b.id}`}
                          value={b.tempat ?? ''}
                          onChange={(e) => ubah(b.id, { tempat: e.target.value })}
                          placeholder="Tempat (opsional)"
                        />
                      </div>
                    )}

                    {cabang.length === 0 ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <Button size="sm" data-testid={`jadikan-paralel-${b.id}`} onClick={() => jadikanParalel(b)} disabled={seksi.length < 2}>
                          ⇉ Bagi per seksi
                        </Button>
                        <span className="text-[11px] text-slate-500">
                          {seksi.length < 2
                            ? 'Butuh minimal dua seksi aktif.'
                            : `Jam yang sama, kegiatan berbeda: ${seksi.map((s) => s.label).join(', ')}.`}
                        </span>
                      </div>
                    ) : (
                      <div className="space-y-2" data-testid={`cabang-blok-${b.id}`}>
                        {cabang.map((c) => (
                          <div key={c.id} data-testid={`cabang-${c.id}`} className="rounded-md border border-slate-700 bg-slate-900/60 p-2">
                            <div className="mb-1.5 flex flex-wrap items-center gap-1">
                              {seksi.map((s) => {
                                const on = c.seksi.includes(s.id)
                                return (
                                  <button
                                    key={s.id}
                                    type="button"
                                    data-testid={`cabang-seksi-${c.id}-${s.id}`}
                                    aria-pressed={on}
                                    onClick={() =>
                                      ubahCabang(b, c.id, { seksi: on ? c.seksi.filter((x) => x !== s.id) : [...c.seksi, s.id] })
                                    }
                                    className={`rounded-full border px-2 py-0.5 text-[11px] ${
                                      on ? 'border-cyan-500 bg-cyan-500/15 text-cyan-200' : 'border-slate-600 text-slate-500'
                                    }`}
                                  >
                                    <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: s.dot }} />
                                    {s.label}
                                  </button>
                                )
                              })}
                              <button
                                type="button"
                                data-testid={`cabang-hapus-${c.id}`}
                                onClick={() => ubah(b.id, { cabang: cabang.filter((x) => x.id !== c.id) })}
                                className="ml-auto rounded px-1 text-slate-500 hover:bg-slate-700 hover:text-rose-300"
                                title="Hapus jalur"
                              >
                                ✕
                              </button>
                            </div>
                            <div className="grid gap-1.5 sm:grid-cols-2">
                              <Input
                                data-testid={`cabang-judul-${c.id}`}
                                value={c.judul}
                                onChange={(e) => ubahCabang(b, c.id, { judul: e.target.value })}
                                placeholder="Materi jalur ini"
                              />
                              <Select
                                data-testid={`cabang-jenis-${c.id}`}
                                value={c.jenis ?? ''}
                                onChange={(e) => ubahCabang(b, c.id, { jenis: (e.target.value || undefined) as JenisBlok | undefined })}
                              >
                                <option value="">Ranah ikut blok ({LABEL_BLOK[b.jenis]})</option>
                                {URUTAN_BLOK.map((t) => (
                                  <option key={t} value={t}>
                                    {LABEL_BLOK[t]}
                                  </option>
                                ))}
                              </Select>
                              <Input
                                data-testid={`cabang-pelatih-${c.id}`}
                                value={c.pelatih ?? ''}
                                onChange={(e) => ubahCabang(b, c.id, { pelatih: e.target.value })}
                                placeholder="Pelatih"
                              />
                              <Input
                                data-testid={`cabang-tempat-${c.id}`}
                                value={c.tempat ?? ''}
                                onChange={(e) => ubahCabang(b, c.id, { tempat: e.target.value })}
                                placeholder="Tempat"
                              />
                            </div>
                          </div>
                        ))}
                        <div className="flex flex-wrap gap-2">
                          <Button size="sm" data-testid={`tambah-cabang-${b.id}`} onClick={() => tambahCabang(b)}>
                            + Jalur
                          </Button>
                          <Button size="sm" variant="ghost" data-testid={`hapus-paralel-${b.id}`} onClick={() => ubah(b.id, { cabang: [] })}>
                            Jadikan blok bersama
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <div className="min-w-[10rem] flex-1">
          <Input
            data-testid="nama-blok"
            value={judul}
            onChange={(e) => setJudul(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                tambah()
              }
            }}
            placeholder="mis. Sikap & langkah dasar"
          />
        </div>
        <Select data-testid="jenis-blok" value={jenis} onChange={(e) => setJenis(e.target.value as JenisBlok)} className="w-36">
          {URUTAN_BLOK.map((t) => (
            <option key={t} value={t}>
              {LABEL_BLOK[t]}
            </option>
          ))}
        </Select>
        <Input data-testid="menit-blok" type="number" min={1} value={menit} onChange={(e) => setMenit(e.target.value)} className="w-20" />
        <Button data-testid="tambah-blok" onClick={tambah}>
          Tambah
        </Button>
      </div>

      {blok.length > 0 && (
        <>
          <p data-testid="ringkasan-rencana" className="mt-2 text-[11px]">
            <span className="text-slate-500">
              Total rencana {formatMenit(totalRencana(blok))}
              {slot != null && <> · slot {formatMenit(slot)}</>}
            </span>
            {lebih === undefined ? null : lebih == null ? (
              <span className="ml-1 text-slate-500">· slotnya tidak terbaca, jadi tidak bisa dinilai</span>
            ) : lebih > 0 ? (
              <span data-testid="rencana-lebih" className="ml-1 font-semibold text-rose-300">
                · lebih {formatMenit(lebih)} dari slotnya — bagian akhir akan kehabisan waktu
              </span>
            ) : (
              <span data-testid="rencana-muat" className="ml-1 text-emerald-400">
                · muat, sisa {formatMenit(-lebih)}
              </span>
            )}
          </p>

          <div data-testid="komposisi-rencana" className="mt-2 rounded-md border border-slate-800 bg-slate-950/40 p-2">
            <p className="text-[11px] text-slate-400">
              Komposisi: <b className="text-slate-200" data-testid="label-komposisi">{labelKomposisi(komp.rataRata) || '—'}</b>
            </p>
            <BilahKomposisi m={komp.rataRata} className="mt-1" />
            <p className="mt-1 text-[10px] text-slate-500">
              {teksKomposisi(komp.rataRata)}
              {komp.adaParalel && seksi.length > 1 ? ' · rata-rata per seksi' : ''}
            </p>
            {komp.adaParalel && seksi.length > 1 && (
              <div className="mt-1.5 space-y-1">
                {seksi.map((s) => (
                  <div key={s.id} data-testid={`komposisi-seksi-${s.id}`} className="grid grid-cols-[4.5rem_1fr] items-center gap-2 text-[10px] text-slate-400">
                    <span className="truncate">{s.label}</span>
                    <span className="min-w-0">
                      <BilahKomposisi m={komp.perSeksi[s.id]} tinggi={4} />
                      <span className="block truncate">{labelKomposisi(komp.perSeksi[s.id])}</span>
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {peringatan.length > 0 && (
            <ul data-testid="peringatan-rencana" className="mt-2 space-y-0.5 text-[11px]">
              {peringatan.map((p, i) => (
                <li key={i} data-kode={p.kode} className={p.tingkat === 'info' ? 'text-slate-400' : 'text-amber-300'}>
                  {p.tingkat === 'info' ? 'ℹ' : '⚠'} {p.teks}
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

/** Penyunting rencana di modal jadwal: daftar blok + muat/simpan pola sesi. */
export function RencanaEditor({ s, setS }: { s: Session; setS: (x: Session) => void }) {
  const settings = useSettings()
  const seksi = useSeksiAktif()
  const toast = useToast()
  const [namaPola, setNamaPola] = useState<string | null>(null)
  const pola = settings.polaSesi ?? []
  const blok = s.rencanaLatihan ?? []
  const lama = lamaSlot(menitDariJam(s.startTime), menitDariJam(s.endTime))

  async function simpan() {
    const nama = (namaPola ?? '').trim()
    if (!nama || !blok.length) return
    const hasil = simpanPola(settings.polaSesi, buatPola(nama, blok, buatId))
    await saveSettings({ polaSesi: hasil.daftar })
    toast.push(hasil.ditimpa ? `Pola “${nama}” diperbarui` : `Pola “${nama}” disimpan`)
    setNamaPola(null)
  }

  return (
    <div>
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <label className="block text-xs font-medium text-slate-400">
          Rencana latihan <span className="text-slate-600">— opsional</span>
        </label>
        <div className="flex flex-wrap items-center gap-1">
          {pola.length > 0 && (
            <div className="w-44">
            <Select
              data-testid="muat-pola"
              value=""
              onChange={(e) => {
                const p = pola.find((x) => x.id === e.target.value)
                if (p) {
                  setS({ ...s, rencanaLatihan: salinRencana(p.rencana, buatId) })
                  toast.push(`Isi sesi diganti dengan pola “${p.nama}”`, 'info')
                }
              }}
              className="py-1 text-xs"
            >
              <option value="">Muat pola…</option>
              {pola.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nama}
                </option>
              ))}
            </Select>
            </div>
          )}
          {blok.length > 0 && namaPola == null && (
            <Button size="sm" variant="ghost" data-testid="simpan-pola" onClick={() => setNamaPola(s.title || '')}>
              Simpan sebagai pola
            </Button>
          )}
        </div>
      </div>
      {namaPola != null && (
        <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md border border-slate-700 p-2">
          <Input
            data-testid="nama-pola"
            autoFocus
            value={namaPola}
            onChange={(e) => setNamaPola(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                simpan()
              }
            }}
            placeholder="mis. Latsar A — Fisik + Visual"
            className="min-w-[12rem] flex-1"
          />
          <Button size="sm" variant="primary" data-testid="simpan-pola-ya" onClick={simpan} disabled={!namaPola.trim()}>
            Simpan
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setNamaPola(null)}>
            Batal
          </Button>
          <p className="w-full text-[10px] text-slate-500">Nama yang sama dengan pola lama akan menimpanya.</p>
        </div>
      )}
      <p className="mb-2 text-[11px] text-slate-500">
        Bagi sesi menjadi blok waktu dan pilih ranahnya (fisik, visual, musik, section, drill…). Tombol ⋯ membuka
        pelatih, tempat, dan pembagian paralel per seksi.
      </p>
      <PenyuntingBlok blok={blok} onChange={(b) => setS({ ...s, rencanaLatihan: b })} slot={lama} seksi={seksi} />
    </div>
  )
}
