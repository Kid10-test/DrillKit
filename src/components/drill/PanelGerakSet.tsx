/**
 * #12c, #16.1, & #16.3 — Panel Gerakan & Koreografi Visual per Set:
 *  - DD2: bentuk jalur utama (`lurus`, `lengkung`, `busur`), pembagian kecepatan, & tunda seksi,
 *  - #16.1: jalur per sub-kelompok pemain & *Follow-the-Leader* (FTL),
 *  - #16.3: pembagian *Move + Hold* (`Jalan X + Hold Y`), gelombang *Ripple* (`A/B/C/D` / `1..N`),
 *           serta simbol visual/tanduk (`Horn Up, Horn Snap, Mark Time, Halt, Lunge, Choreo`).
 */
import { useState } from 'react'
import type {
  DrillSet,
  GerakKelompok,
  GerakSet,
  InstruksiVisualSet,
  JenisSimbolVisual,
  Member,
} from '../../db/types'
import {
  DAFTAR_SIMBOL_VISUAL,
  JALUR_LABEL,
  MUDAH_LABEL,
  labelGelombangRipple,
  type GerakLengkap,
} from '../../lib/gerak'
import { cx, sectionLabel, uid } from '../../lib/utils'
import { Button, Input, Select } from '../ui'

export function PanelGerakSet({
  set,
  adaSetBerikut,
  gerakSet,
  simpanGerak,
  simpanVisual,
  pusatPutar,
  pusatAkhirPutar,
  ubahPutar,
  hapusPusatAkhir,
  hitungPusatAkhir,
  jumlahIkutBusur,
  seksiUnik,
  selectedIds,
  rosterById,
}: {
  set: DrillSet
  adaSetBerikut: boolean
  gerakSet: GerakLengkap
  simpanGerak: (patch: Partial<GerakSet>) => void
  simpanVisual: (vis: InstruksiVisualSet | undefined) => void
  pusatPutar: { x: number; y: number }
  pusatAkhirPutar: { x: number; y: number } | null
  ubahPutar: (p: { sudut?: number; x?: number; y?: number; x2?: number; y2?: number }) => void
  hapusPusatAkhir: () => void
  hitungPusatAkhir: () => void
  jumlahIkutBusur: number
  seksiUnik: string[]
  selectedIds: string[]
  rosterById: Map<string, Member>
}) {
  const [namaKlpBaru, setNamaKlpBaru] = useState('')
  const [jalurKlpBaru, setJalurKlpBaru] = useState<'ftl' | 'lengkung' | 'lurus'>('ftl')
  const [jmlGelombangRipple, setJmlGelombangRipple] = useState(4)

  const counts = Math.max(0, set.counts || 0)
  const jalanAktif =
    typeof gerakSet.jalanCount === 'number' && gerakSet.jalanCount > 0 && gerakSet.jalanCount < counts
      ? gerakSet.jalanCount
      : counts
  const holdCount = Math.max(0, counts - jalanAktif)
  const daftarKlp = gerakSet.kelompok ?? []
  const ripple = gerakSet.ripple
  const vis = set.visual

  function jugSimbol(id: JenisSimbolVisual) {
    const skrg = new Set(vis?.simbol ?? [])
    if (skrg.has(id)) skrg.delete(id)
    else skrg.add(id)
    const simbolBaru = [...skrg]
    if (!simbolBaru.length && !vis?.catatan?.trim()) {
      simpanVisual(undefined)
    } else {
      simpanVisual({ ...(vis ?? { simbol: [] }), simbol: simbolBaru })
    }
  }

  function ubahCatatanVisual(teks: string) {
    const simbol = vis?.simbol ?? []
    if (!simbol.length && !teks.trim()) {
      simpanVisual(undefined)
    } else {
      simpanVisual({ ...(vis ?? { simbol: [] }), simbol, catatan: teks })
    }
  }

  function tambahKelompokDariPilihan() {
    const kandidat = selectedIds.filter((id) => set.points[id])
    if (kandidat.length < 1) return
    const bersihLama = daftarKlp
      .map((k) => ({ ...k, memberIds: k.memberIds.filter((id) => !kandidat.includes(id)) }))
      .filter((k) => k.memberIds.length > 0)
    const klpBaru: GerakKelompok = {
      id: uid('klp_'),
      nama: namaKlpBaru.trim() || (jalurKlpBaru === 'ftl' ? `FTL ${bersihLama.length + 1}` : `Kelompok ${bersihLama.length + 1}`),
      memberIds: kandidat,
      jalur: jalurKlpBaru,
      ...(jalurKlpBaru === 'lengkung' ? { lengkung: 0.4 } : {}),
    }
    simpanGerak({ kelompok: [...bersihLama, klpBaru] })
    setNamaKlpBaru('')
  }

  function hapusKelompok(id: string) {
    const sisa = daftarKlp.filter((k) => k.id !== id)
    simpanGerak({ kelompok: sisa.length ? sisa : undefined })
  }

  function balikUrutanFtl(id: string) {
    simpanGerak({
      kelompok: daftarKlp.map((k) =>
        k.id === id ? { ...k, memberIds: [...k.memberIds].reverse() } : k,
      ),
    })
  }

  function pasangRippleOtomatis(arah: 'kiri_kanan' | 'pilihan') {
    const target =
      arah === 'pilihan' && selectedIds.length >= 2
        ? selectedIds.filter((id) => set.points[id])
        : Object.keys(set.points).sort((a, b) => (set.points[b]?.x ?? 0) - (set.points[a]?.x ?? 0))
    if (!target.length) return
    const nGel = Math.max(2, Math.min(target.length, jmlGelombangRipple))
    const urutan: Record<string, number> = { ...(ripple?.urutan ?? {}) }
    target.forEach((id, idx) => {
      urutan[id] = arah === 'pilihan' ? idx % nGel : Math.min(nGel - 1, Math.floor((idx / target.length) * nGel))
    })
    simpanGerak({
      ripple: {
        selangCount: ripple?.selangCount ?? 2,
        urutan,
        mode: ripple?.mode ?? 'kejar',
      },
    })
  }

  return (
    <div className="mt-3 space-y-3 border-t border-slate-800 pt-3" data-testid="panel-koreografi-set">
      {/* #16.3 — Simbol Visual / Tanduk / Koreografi (berlaku bahkan di set terakhir / diam) */}
      <div>
        <label className="mb-1.5 block text-[11px] font-medium text-slate-300">
          Simbol visual &amp; tanduk (dicetak di buku saku &amp; HP anggota)
        </label>
        <div className="flex flex-wrap gap-1" data-testid="daftar-tombol-simbol-visual">
          {DAFTAR_SIMBOL_VISUAL.map((s) => {
            const aktif = Boolean(vis?.simbol?.includes(s.id))
            return (
              <button
                key={s.id}
                type="button"
                data-testid={`simbol-visual-${s.id}`}
                onClick={() => jugSimbol(s.id)}
                className={cx(
                  'rounded-lg border px-2 py-1 text-[11px] font-medium transition',
                  aktif
                    ? 'border-amber-500/60 bg-amber-500/20 text-amber-200'
                    : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:bg-slate-800 hover:text-slate-200',
                )}
              >
                {s.ikon} {s.label}
              </button>
            )
          })}
        </div>
        <Input
          className="mt-1.5 py-1 text-xs"
          data-testid="input-catatan-visual"
          placeholder="Catatan koreografi singkat set ini (mis. Snap hitungan 13)…"
          value={vis?.catatan ?? ''}
          onChange={(e) => ubahCatatanVisual(e.target.value)}
        />
      </div>

      {/* DD2 & #16 — Gerakan menuju set berikutnya */}
      {adaSetBerikut && (
        <div className="space-y-3 border-t border-slate-800/80 pt-3">
          <label className="block text-[11px] font-medium text-slate-300">
            Gerakan ke set berikutnya
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">Bentuk jalur</label>
              <Select
                value={gerakSet.jalur}
                onChange={(e) =>
                  simpanGerak({ jalur: e.target.value as 'lurus' | 'lengkung' | 'busur' })
                }
                aria-label="Bentuk jalur perpindahan"
              >
                {(Object.keys(JALUR_LABEL) as ('lurus' | 'lengkung' | 'busur')[]).map((k) => (
                  <option key={k} value={k}>
                    {JALUR_LABEL[k]}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">
                Pembagian kecepatan
              </label>
              <Select
                value={gerakSet.mudah}
                onChange={(e) =>
                  simpanGerak({ mudah: e.target.value as GerakLengkap['mudah'] })
                }
                aria-label="Pembagian kecepatan perpindahan"
              >
                {(Object.keys(MUDAH_LABEL) as GerakLengkap['mudah'][]).map((k) => (
                  <option key={k} value={k}>
                    {MUDAH_LABEL[k]}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {gerakSet.jalur === 'lengkung' && (
            <div>
              <label className="mb-1 block text-[11px] text-slate-500">
                Lengkungan: {Math.round(gerakSet.lengkung * 100)}%
              </label>
              <input
                type="range"
                min={-100}
                max={100}
                step={25}
                value={Math.round(gerakSet.lengkung * 100)}
                onChange={(e) => simpanGerak({ lengkung: Number(e.target.value) / 100 })}
                className="w-full accent-sky-500"
                aria-label="Lengkungan jalur"
              />
            </div>
          )}

          {gerakSet.jalur === 'busur' && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <span className="w-24 shrink-0 text-[11px] text-slate-500">Sudut putar</span>
                <Input
                  type="number"
                  step={15}
                  value={gerakSet.putar?.sudut ?? 0}
                  onChange={(e) => ubahPutar({ sudut: Number(e.target.value) })}
                  aria-label="Sudut putar busur"
                />
                <span className="shrink-0 text-[11px] text-slate-500">derajat</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-24 shrink-0 text-[11px] text-slate-500">
                  Pusat putaran
                </span>
                <Input
                  type="number"
                  step={0.25}
                  value={pusatPutar.x}
                  onChange={(e) => ubahPutar({ x: Number(e.target.value) })}
                  aria-label="Pusat putaran, sumbu x (langkah)"
                />
                <Input
                  type="number"
                  step={0.25}
                  value={pusatPutar.y}
                  onChange={(e) => ubahPutar({ y: Number(e.target.value) })}
                  aria-label="Pusat putaran, sumbu y (langkah)"
                />
              </div>

              <label className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <input
                  type="checkbox"
                  className="accent-sky-500"
                  checked={pusatAkhirPutar !== null}
                  onChange={(e) =>
                    e.target.checked
                      ? ubahPutar({ x2: pusatPutar.x, y2: pusatPutar.y })
                      : hapusPusatAkhir()
                  }
                  data-testid="putar-jalan-aktif"
                />
                Lingkaran ikut berjalan (pusatnya berpindah)
              </label>

              {pusatAkhirPutar && (
                <div className="flex items-center gap-1.5">
                  <span className="w-24 shrink-0 text-[11px] text-slate-500">
                    Berpindah ke
                  </span>
                  <Input
                    type="number"
                    step={0.25}
                    value={pusatAkhirPutar.x}
                    onChange={(e) => ubahPutar({ x2: Number(e.target.value) })}
                    aria-label="Pusat putaran berpindah ke, sumbu x (langkah)"
                    data-testid="putar-jalan-x2"
                  />
                  <Input
                    type="number"
                    step={0.25}
                    value={pusatAkhirPutar.y}
                    onChange={(e) => ubahPutar({ y2: Number(e.target.value) })}
                    aria-label="Pusat putaran berpindah ke, sumbu y (langkah)"
                    data-testid="putar-jalan-y2"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    className="shrink-0 px-2 py-1 text-[11px]"
                    onClick={hitungPusatAkhir}
                    data-testid="putar-jalan-hitung"
                  >
                    Hitung
                  </Button>
                </div>
              )}

              <p className="text-[10px] leading-snug text-slate-500" data-testid="putar-jalan-keterangan">
                {jumlahIkutBusur} dari {Object.keys(set.points).length} pemain mengikuti
                busur ini — sisanya tetap jalur lurus/melengkung karena perpindahannya tidak
                cocok dengan putaran ini. Pusat diukur dalam langkah dari titik tengah
                lapangan.
                {pusatAkhirPutar && (
                  <>
                    {' '}
                    Lingkaran berputar sambil pusatnya bergeser dari {pusatPutar.x},{' '}
                    {pusatPutar.y} ke {pusatAkhirPutar.x}, {pusatAkhirPutar.y} — jadi
                    bentuk formasi tetap utuh sementara seluruh blok terbawa maju.
                  </>
                )}
              </p>
            </div>
          )}

          {/* #16.3 — Pembagian Move + Hold dalam satu set */}
          {counts >= 2 && (
            <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2.5" data-testid="panel-move-hold">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="text-[11px] font-medium text-slate-300" htmlFor="input-jalan-count">
                  Pembagian Jalan + Hold ({counts} hitungan)
                </label>
                {holdCount > 0 && (
                  <span
                    data-testid="lencana-move-hold"
                    className="rounded border border-emerald-500/40 bg-emerald-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-200"
                  >
                    Jalan {jalanAktif} + Hold {holdCount}
                  </span>
                )}
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <Input
                  id="input-jalan-count"
                  data-testid="input-jalan-count"
                  type="number"
                  min={1}
                  max={counts}
                  value={jalanAktif}
                  onChange={(e) => {
                    const n = Math.max(1, Math.min(counts, Math.round(Number(e.target.value) || counts)))
                    simpanGerak({ jalanCount: n >= counts ? undefined : n })
                  }}
                  className="w-20 py-1 text-xs"
                />
                <span className="text-[11px] text-slate-400">
                  hitungan jalan · <b>{holdCount}</b> hitungan diam (Hold)
                </span>
              </div>
            </div>
          )}

          {/* #16.1 — Jalur Per-Kelompok & Follow-the-Leader (FTL) */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2.5" data-testid="panel-kelompok-ftl">
            <p className="text-[11px] font-medium text-slate-300">
              Jalur per sub-kelompok &amp; Follow-the-Leader (FTL)
            </p>
            <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
              Pilih pemain secara berurutan di kanvas (orang pertama = <b>Pemimpin FTL</b>), lalu tambahkan kelompok.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <Select
                data-testid="pilih-jalur-kelompok"
                value={jalurKlpBaru}
                onChange={(e) => setJalurKlpBaru(e.target.value as 'ftl' | 'lengkung' | 'lurus')}
                className="w-36 py-1 text-xs"
                aria-label="Jenis jalur sub-kelompok"
              >
                <option value="ftl">Follow-the-Leader (FTL)</option>
                <option value="lengkung">Melengkung khusus</option>
                <option value="lurus">Lurus khusus</option>
              </Select>
              <Input
                data-testid="input-nama-kelompok"
                value={namaKlpBaru}
                onChange={(e) => setNamaKlpBaru(e.target.value)}
                placeholder="Nama barisan…"
                className="min-w-[110px] flex-1 py-1 text-xs"
              />
              <Button
                size="sm"
                variant="soft"
                data-testid="tambah-kelompok-gerak"
                disabled={selectedIds.length < (jalurKlpBaru === 'ftl' ? 2 : 1)}
                onClick={tambahKelompokDariPilihan}
              >
                + Kelompok ({selectedIds.length})
              </Button>
            </div>

            {daftarKlp.length > 0 && (
              <ul className="mt-2 space-y-1.5" data-testid="daftar-kelompok-gerak">
                {daftarKlp.map((k) => {
                  const kodeAnggota = k.memberIds
                    .map((id) => rosterById.get(id)?.code ?? id)
                    .join(' → ')
                  return (
                    <li
                      key={k.id}
                      data-testid={`item-kelompok-${k.id}`}
                      className="rounded border border-slate-800 bg-slate-900/70 px-2 py-1.5 text-[11px]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-sky-200">
                          {k.nama}{' '}
                          <span className="text-[10px] font-normal text-slate-400">
                            ({k.jalur === 'ftl' ? 'FTL' : k.jalur} · {k.memberIds.length} pemain)
                          </span>
                        </span>
                        <div className="flex items-center gap-1">
                          {k.jalur === 'ftl' && (
                            <button
                              type="button"
                              data-testid={`balik-ftl-${k.id}`}
                              onClick={() => balikUrutanFtl(k.id)}
                              className="rounded px-1.5 py-0.5 text-[10px] text-slate-300 hover:bg-slate-800"
                              title="Balik urutan pemimpin FTL"
                            >
                              ⇄ Balik
                            </button>
                          )}
                          <button
                            type="button"
                            data-testid={`hapus-kelompok-${k.id}`}
                            onClick={() => hapusKelompok(k.id)}
                            className="rounded px-1.5 py-0.5 text-[10px] text-rose-300 hover:bg-rose-950/60"
                          >
                            ✕
                          </button>
                        </div>
                      </div>
                      <p className="mt-0.5 truncate text-[10px] text-slate-400">{kodeAnggota}</p>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          {/* #16.3 — Gelombang Ripple (A/B/C/D) */}
          <div className="rounded-lg border border-slate-800 bg-slate-950/50 p-2.5" data-testid="panel-ripple">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-medium text-slate-300">
                Gelombang Ripple (A / B / C / D)
              </span>
              {ripple && (
                <button
                  type="button"
                  data-testid="hapus-ripple"
                  onClick={() => simpanGerak({ ripple: undefined })}
                  className="text-[10px] text-rose-300 hover:underline"
                >
                  Reset ripple
                </button>
              )}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              <Select
                data-testid="pilih-jumlah-gelombang-ripple"
                value={String(jmlGelombangRipple)}
                onChange={(e) => setJmlGelombangRipple(Number(e.target.value))}
                className="w-24 py-1 text-xs"
                aria-label="Jumlah gelombang ripple"
              >
                {[2, 3, 4, 6, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} grup (A–{labelGelombangRipple(n - 1)})
                  </option>
                ))}
              </Select>
              <Button
                size="sm"
                variant="soft"
                data-testid="pasang-ripple-kiri-kanan"
                onClick={() => pasangRippleOtomatis('kiri_kanan')}
              >
                Bagi S1→S2
              </Button>
              {selectedIds.length >= 2 && (
                <Button
                  size="sm"
                  variant="soft"
                  data-testid="pasang-ripple-pilihan"
                  onClick={() => pasangRippleOtomatis('pilihan')}
                >
                  Bagi pilihan ({selectedIds.length})
                </Button>
              )}
            </div>
            {ripple && (
              <div className="mt-2 grid grid-cols-2 gap-2">
                <div>
                  <label className="mb-0.5 block text-[10px] text-slate-400" htmlFor="selang-ripple">
                    Selang antar grup (hit.)
                  </label>
                  <Input
                    id="selang-ripple"
                    data-testid="input-selang-ripple"
                    type="number"
                    min={1}
                    max={8}
                    value={ripple.selangCount}
                    onChange={(e) =>
                      simpanGerak({
                        ripple: {
                          ...ripple,
                          selangCount: Math.max(1, Number(e.target.value) || 1),
                        },
                      })
                    }
                    className="py-1 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-0.5 block text-[10px] text-slate-400" htmlFor="mode-ripple">
                    Cara tiba
                  </label>
                  <Select
                    id="mode-ripple"
                    data-testid="pilih-mode-ripple"
                    value={ripple.mode ?? 'kejar'}
                    onChange={(e) =>
                      simpanGerak({
                        ripple: { ...ripple, mode: e.target.value as 'kejar' | 'bertahap' },
                      })
                    }
                    className="py-1 text-xs"
                  >
                    <option value="kejar">Tiba bersama</option>
                    <option value="bertahap">Durasi sama</option>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* DD2 — Tunda mulai per section */}
          <div>
            <label className="mb-1 block text-[11px] text-slate-500">
              Tunda mulai per section (count)
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {seksiUnik.map((sc) => (
                <div key={sc} className="flex items-center gap-1.5">
                  <span className="w-14 shrink-0 truncate text-[11px] text-slate-400">
                    {sectionLabel(sc)}
                  </span>
                  <Input
                    type="number"
                    min={0}
                    value={gerakSet.tunda[sc] ?? 0}
                    onChange={(e) =>
                      simpanGerak({
                        tunda: {
                          ...gerakSet.tunda,
                          [sc]: Math.max(0, Number(e.target.value)),
                        },
                      })
                    }
                    aria-label={`Tunda section ${sectionLabel(sc)}`}
                  />
                </div>
              ))}
            </div>
            <p className="mt-1.5 text-[11px] leading-relaxed text-slate-500">
              Section yang ditunda diam beberapa count lebih dulu, lalu <b>mengejar</b>{' '}
              supaya tetap tiba bersamaan di akhir.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
