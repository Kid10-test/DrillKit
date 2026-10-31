import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type {
  ButirManifesLogistik,
  KategoriInventaris,
  ManifesLogistikLomba,
  Member,
  Session,
} from '../../db/types'
import {
  DAFTAR_KATEGORI_INVENTARIS,
  LABEL_PENDEK_KATEGORI,
  ringkasManifesLogistik,
  statusBarisManifes,
  susunButirManifesDariInventaris,
} from '../../lib/inventarisLogistik'
import { bangunHtmlManifesLogistik } from '../../lib/inventarisLogistikCetak'
import { downloadHtmlFile, printHtml } from '../../lib/print'
import { cx, slugify, uid } from '../../lib/utils'
import { IconDownload, IconPlus, IconPrinter } from '../Icons'
import { Button, Card, ConfirmButton, EmptyState, Field, Input, Modal, Select, useToast } from '../ui'

type TahapManifes = NonNullable<ManifesLogistikLomba['tahapAktif']>

export function PanelLogistikLomba({
  tanggalAktif,
  sesiAktif,
  namaTim,
  members,
}: {
  tanggalAktif: string
  sesiAktif?: Session
  namaTim: string
  members: Member[]
}) {
  const toast = useToast()
  const semuaManifes = useLiveQuery(() => db.logistikLomba.toArray(), [], [])
  const semuaInventaris = useLiveQuery(() => db.inventaris.toArray(), [], [])

  const manifesDb = useMemo(
    () => (semuaManifes ?? []).find((m) => m.tanggal === tanggalAktif) ?? null,
    [semuaManifes, tanggalAktif],
  )

  // Draf sinkron via useRef + useState agar centang 3-tahap beruntun bebas race Dexie
  const [draf, setDraf] = useState<ManifesLogistikLomba | null>(null)
  const drafRef = useRef<ManifesLogistikLomba | null>(null)

  useEffect(() => {
    drafRef.current = manifesDb
    setDraf(manifesDb)
  }, [manifesDb])

  const [namaButirBaru, setNamaButirBaru] = useState('')
  const [jmlButirBaru, setJmlButirBaru] = useState('1')
  const [katButirBaru, setKatButirBaru] = useState<KategoriInventaris>('lainnya')
  const [pratinjauOpen, setPratinjauOpen] = useState(false)

  async function simpanManifes(berikut: ManifesLogistikLomba) {
    const rapi: ManifesLogistikLomba = {
      ...berikut,
      updatedAt: Date.now(),
    }
    drafRef.current = rapi
    setDraf(rapi)
    await db.logistikLomba.put(rapi)
  }

  async function buatManifesBaru(pakaiInventaris: boolean) {
    const skrg = Date.now()
    const butirAwal = pakaiInventaris
      ? susunButirManifesDariInventaris({
          inventaris: semuaInventaris ?? [],
          sertakanStandarUmum: true,
        })
      : []
    const baru: ManifesLogistikLomba = {
      id: uid('mnf_'),
      judul: sesiAktif?.title || `Lomba / Penampilan ${tanggalAktif}`,
      tanggal: tanggalAktif,
      sessionId: sesiAktif?.id,
      kendaraan: 'Truk Logistik Unit',
      koordinator: '',
      tahapAktif: 'berangkat',
      catatan: sesiAktif?.place ? `Lokasi: ${sesiAktif.place}` : undefined,
      butir: butirAwal,
      createdAt: skrg,
      updatedAt: skrg,
    }
    await simpanManifes(baru)
    toast.push(
      pakaiInventaris
        ? `Manifes dibuat dengan ${butirAwal.length} barang dari inventaris & standar lomba`
        : 'Manifes kosong siap diisi',
    )
  }

  async function tarikDariInventaris() {
    const saatIni = drafRef.current
    if (!saatIni) return
    const gabungan = susunButirManifesDariInventaris({
      inventaris: semuaInventaris ?? [],
      butirSaatIni: saatIni.butir,
      sertakanStandarUmum: true,
    })
    const selisih = gabungan.length - saatIni.butir.length
    if (selisih === 0) {
      toast.push('Semua aset wajib lomba sudah tercatat di manifes ini', 'info')
      return
    }
    await simpanManifes({
      ...saatIni,
      butir: gabungan,
    })
    toast.push(`${selisih} barang ditambahkan ke manifes`)
  }

  function toggleCentangTahap(
    butirId: string,
    kolom: 'muatBerangkat' | 'cekLokasi' | 'kembaliGudang',
  ) {
    const saatIni = drafRef.current
    if (!saatIni) return
    const skrg = Date.now()
    const butirBaru: ButirManifesLogistik[] = saatIni.butir.map((b) => {
      if (b.id !== butirId) return b
      const nyala = b[kolom] === 1 ? 0 : 1
      return {
        ...b,
        [kolom]: nyala,
        ...(kolom === 'muatBerangkat' ? { waktuBerangkat: nyala ? skrg : undefined } : {}),
        ...(kolom === 'cekLokasi' ? { waktuLokasi: nyala ? skrg : undefined } : {}),
        ...(kolom === 'kembaliGudang' ? { waktuKembali: nyala ? skrg : undefined } : {}),
      }
    })
    void simpanManifes({ ...saatIni, butir: butirBaru })
  }

  function centangSemuaTahap(
    kolom: 'muatBerangkat' | 'cekLokasi' | 'kembaliGudang',
    nilai: 0 | 1,
  ) {
    const saatIni = drafRef.current
    if (!saatIni) return
    void simpanManifes({
      ...saatIni,
      butir: saatIni.butir.map((b) => ({ ...b, [kolom]: nilai })),
    })
  }

  function tambahButirManual() {
    const saatIni = drafRef.current
    if (!saatIni || !namaButirBaru.trim()) return
    const baru: ButirManifesLogistik = {
      id: uid('bml_'),
      nama: namaButirBaru.trim(),
      kategori: katButirBaru,
      jumlah: Math.max(1, Number(jmlButirBaru) || 1),
      satuan: 'unit',
      muatBerangkat: 0,
      cekLokasi: 0,
      kembaliGudang: 0,
    }
    setNamaButirBaru('')
    setJmlButirBaru('1')
    void simpanManifes({
      ...saatIni,
      butir: [...saatIni.butir, baru],
    })
  }

  const ringkas = useMemo(
    () => (draf ? ringkasManifesLogistik(draf) : null),
    [draf],
  )

  const htmlManifes = useMemo(
    () =>
      pratinjauOpen && draf
        ? bangunHtmlManifesLogistik({
            namaTim,
            manifes: draf,
            members,
          })
        : '',
    [pratinjauOpen, draf, namaTim, members],
  )

  if (!draf) {
    return (
      <div data-testid="panel-logistik-lomba">
        <EmptyState
          title={`Belum ada Manifes Loading Truk untuk ${tanggalAktif}`}
          desc="Susun ceklis keberangkatan 3-tahap (1. Muat di Markas → 2. Cek Tiba di Lokasi → 3. Cek Pulang ke Gudang) agar tidak ada instrumen, podium, atau kabel pit yang tertinggal."
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button
                variant="primary"
                data-testid="buat-manifes-inventaris"
                onClick={() => void buatManifesBaru(true)}
              >
                <IconPlus size={15} /> Buat Manifes + Tarik dari Inventaris ({semuaInventaris.length} aset)
              </Button>
              <Button
                variant="ghost"
                data-testid="buat-manifes-kosong"
                onClick={() => void buatManifesBaru(false)}
              >
                Buat Manifes Kosong
              </Button>
            </div>
          }
        />
      </div>
    )
  }

  const adaYangSudahPulang = (ringkas?.sudahKembaliGudang ?? 0) > 0

  return (
    <div data-testid="panel-logistik-lomba" className="space-y-4">
      {/* Peringatan Merah Real-time Barang Belum Kembali ke Gudang */}
      {ringkas && ringkas.belumKembaliMerah.length > 0 && (
        <div
          data-testid="peringatan-belum-kembali"
          className="rounded-xl border-2 border-rose-500/80 bg-rose-950/70 p-3.5 text-rose-100 shadow-lg"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-bold tracking-wide text-rose-300 uppercase">
                Peringatan Logistik — {ringkas.belumKembaliMerah.length} Barang Belum Kembali ke Gudang!
              </p>
              <p className="mt-0.5 text-xs text-rose-200">
                Jangan bubarkan tim bongkar-muat sebelum seluruh barang yang dibawa berangkat tercentang pada kolom{' '}
                <b>3. Gudang</b>:{' '}
                <span className="font-semibold">
                  {ringkas.belumKembaliMerah
                    .slice(0, 5)
                    .map((b) => (b.kodeAset ? `${b.kodeAset} (${b.nama})` : b.nama))
                    .join(', ')}
                  {ringkas.belumKembaliMerah.length > 5
                    ? ` +${ringkas.belumKembaliMerah.length - 5} lainnya`
                    : ''}
                </span>
              </p>
            </div>
            <Button
              size="sm"
              variant="danger"
              data-testid="lompat-fase-pulang"
              onClick={() => void simpanManifes({ ...draf, tahapAktif: 'pulang' })}
            >
              Fokus Cek Pulang
            </Button>
          </div>
        </div>
      )}

      {/* Header Identitas Manifes & Fase 3-Tahap */}
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-semibold tracking-wider text-emerald-400 uppercase">
              Manifes Logistik Hari Lomba · {draf.tanggal}
            </p>
            <h2 className="text-base font-bold text-slate-100">{draf.judul}</h2>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <Button
              size="sm"
              variant="ghost"
              data-testid="tarik-inventaris-manifes"
              onClick={() => void tarikDariInventaris()}
            >
              + Tarik Inventaris
            </Button>
            <Button
              size="sm"
              variant="primary"
              data-testid="pratinjau-cetak-manifes"
              onClick={() => setPratinjauOpen(true)}
            >
              <IconPrinter size={14} /> Cetak Manifes A4
            </Button>
            <ConfirmButton
              size="sm"
              label="Hapus Manifes"
              message="Hapus seluruh manifes logistik pada tanggal ini?"
              onConfirm={async () => {
                await db.logistikLomba.delete(draf.id)
                toast.push('Manifes dihapus', 'info')
              }}
            />
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          <Field label="Judul Kegiatan">
            <Input
              data-testid="input-nama-manifes"
              value={draf.judul}
              onChange={(e) => void simpanManifes({ ...draf, judul: e.target.value })}
              className="text-xs"
            />
          </Field>
          <Field label="Kendaraan / Plat Truk">
            <Input
              data-testid="input-kendaraan-manifes"
              value={draf.kendaraan ?? ''}
              onChange={(e) => void simpanManifes({ ...draf, kendaraan: e.target.value })}
              placeholder="Mis. Truk Box AB 8812 XY"
              className="text-xs"
            />
          </Field>
          <Field label="Koordinator Logistik">
            <Input
              data-testid="input-koordinator-manifes"
              value={draf.koordinator ?? ''}
              onChange={(e) => void simpanManifes({ ...draf, koordinator: e.target.value })}
              placeholder="Mis. Seksi Peralatan / Bima"
              className="text-xs"
            />
          </Field>
        </div>

        {/* Pemilih Tahap Aktif + Ringkasan 3-Tahap */}
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            [
              {
                id: 'berangkat' as TahapManifes,
                testId: 'fase-manifes-berangkat',
                judul: '1. Muat Berangkat (Markas)',
                angka: `${ringkas?.sudahBerangkat ?? 0}/${ringkas?.totalButir ?? 0}`,
                aksiId: 'centang-semua-berangkat',
                kolom: 'muatBerangkat' as const,
              },
              {
                id: 'lokasi' as TahapManifes,
                testId: 'fase-manifes-lokasi',
                judul: '2. Tiba di Lokasi Lomba',
                angka: `${ringkas?.sudahCekLokasi ?? 0}/${ringkas?.totalButir ?? 0}`,
                aksiId: 'centang-semua-lokasi',
                kolom: 'cekLokasi' as const,
              },
              {
                id: 'pulang' as TahapManifes,
                testId: 'fase-manifes-pulang',
                judul: '3. Kembali Masuk Gudang',
                angka: `${ringkas?.sudahKembaliGudang ?? 0}/${ringkas?.totalButir ?? 0}`,
                aksiId: 'centang-semua-gudang',
                kolom: 'kembaliGudang' as const,
              },
            ]
          ).map((f) => {
            const aktif = (draf.tahapAktif ?? 'berangkat') === f.id
            return (
              <div
                key={f.id}
                className={cx(
                  'flex items-center justify-between rounded-lg border p-2.5 transition',
                  aktif
                    ? 'border-emerald-500/50 bg-emerald-500/10'
                    : 'border-slate-800 bg-slate-950/50',
                )}
              >
                <button
                  type="button"
                  data-testid={f.testId}
                  onClick={() => void simpanManifes({ ...draf, tahapAktif: f.id })}
                  className="text-left"
                >
                  <div className="text-[11px] font-semibold text-slate-300">{f.judul}</div>
                  <div className="text-base font-bold tabular-nums text-slate-100">{f.angka}</div>
                </button>
                <button
                  type="button"
                  data-testid={f.aksiId}
                  onClick={() => centangSemuaTahap(f.kolom, 1)}
                  className="rounded border border-slate-700 bg-slate-900 px-2 py-1 text-[10px] text-slate-300 hover:border-emerald-500/50 hover:text-emerald-300"
                >
                  Centang Semua
                </button>
              </div>
            )
          })}
        </div>
      </Card>

      {/* Tambah Barang Manual ke Manifes */}
      <Card className="p-3">
        <div className="grid gap-2 sm:grid-cols-6">
          <Input
            data-testid="input-butir-manifes-baru"
            value={namaButirBaru}
            onChange={(e) => setNamaButirBaru(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') tambahButirManual()
            }}
            placeholder="Tambah barang ke manifes (mis. Genset Cadangan, Galon Air, Banner Unit)…"
            className="text-xs sm:col-span-3"
          />
          <Select
            data-testid="pilih-kategori-manifes-baru"
            value={katButirBaru}
            onChange={(e) => setKatButirBaru(e.target.value as KategoriInventaris)}
            className="text-xs"
          >
            {DAFTAR_KATEGORI_INVENTARIS.map((k) => (
              <option key={k} value={k}>
                {LABEL_PENDEK_KATEGORI[k]}
              </option>
            ))}
          </Select>
          <Input
            type="number"
            min={1}
            data-testid="input-jml-manifes-baru"
            value={jmlButirBaru}
            onChange={(e) => setJmlButirBaru(e.target.value)}
            placeholder="Jml"
            className="text-xs"
          />
          <Button
            size="sm"
            variant="primary"
            data-testid="tambah-butir-manifes"
            disabled={!namaButirBaru.trim()}
            onClick={tambahButirManual}
          >
            <IconPlus size={14} /> Tambah
          </Button>
        </div>
      </Card>

      {/* Daftar Ceklis 3-Tahap */}
      {draf.butir.length === 0 ? (
        <EmptyState
          title="Manifes belum berisi barang"
          desc="Klik '+ Tarik Inventaris' di atas atau tambahkan barang manual."
        />
      ) : (
        <Card padded={false} data-testid="tabel-ceklis-manifes">
          <div className="divide-y divide-slate-800/80">
            {draf.butir.map((b, idx) => {
              const status = statusBarisManifes(b, draf.tahapAktif, adaYangSudahPulang)
              const merahBelumKembali = status === 'belum_kembali_merah'
              return (
                <div
                  key={b.id}
                  data-testid={`baris-manifes-${idx}`}
                  data-belum-kembali={merahBelumKembali ? '1' : '0'}
                  className={cx(
                    'flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 transition',
                    merahBelumKembali
                      ? 'bg-rose-950/45 ring-1 ring-inset ring-rose-500/50'
                      : status === 'lengkap_gudang'
                        ? 'bg-emerald-950/15'
                        : '',
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      {b.kodeAset && (
                        <span className="rounded bg-slate-800 px-1.5 py-0.5 font-mono text-[11px] font-bold text-slate-200">
                          {b.kodeAset}
                        </span>
                      )}
                      <span className="text-sm font-semibold text-slate-100">{b.nama}</span>
                      {b.jumlah > 1 && (
                        <span className="rounded bg-slate-800/80 px-1.5 py-0.5 text-[10px] font-bold text-sky-300">
                          ×{b.jumlah}
                        </span>
                      )}
                      <span className="text-[11px] text-slate-400">
                        · {LABEL_PENDEK_KATEGORI[b.kategori]}
                      </span>
                      {merahBelumKembali && (
                        <span
                          data-testid={`badge-belum-kembali-${idx}`}
                          className="rounded-full border border-rose-500/70 bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-200"
                        >
                          BELUM KEMBALI KE GUDANG
                        </span>
                      )}
                    </div>
                  </div>

                  {/* 3 Kotak Centang Real-time */}
                  <div className="flex flex-wrap items-center gap-1.5">
                    <button
                      type="button"
                      data-testid={`centang-berangkat-${idx}`}
                      aria-pressed={b.muatBerangkat === 1}
                      onClick={() => toggleCentangTahap(b.id, 'muatBerangkat')}
                      className={cx(
                        'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition',
                        b.muatBerangkat === 1
                          ? 'border-sky-500/60 bg-sky-500/20 text-sky-200'
                          : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600',
                      )}
                    >
                      {b.muatBerangkat === 1 ? '✓ ' : '☐ '}1. Muat
                    </button>
                    <button
                      type="button"
                      data-testid={`centang-lokasi-${idx}`}
                      aria-pressed={b.cekLokasi === 1}
                      onClick={() => toggleCentangTahap(b.id, 'cekLokasi')}
                      className={cx(
                        'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition',
                        b.cekLokasi === 1
                          ? 'border-amber-500/60 bg-amber-500/20 text-amber-200'
                          : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600',
                      )}
                    >
                      {b.cekLokasi === 1 ? '✓ ' : '☐ '}2. Lokasi
                    </button>
                    <button
                      type="button"
                      data-testid={`centang-gudang-${idx}`}
                      aria-pressed={b.kembaliGudang === 1}
                      onClick={() => toggleCentangTahap(b.id, 'kembaliGudang')}
                      className={cx(
                        'rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition',
                        b.kembaliGudang === 1
                          ? 'border-emerald-500/60 bg-emerald-500/20 text-emerald-200'
                          : merahBelumKembali
                            ? 'border-rose-500/80 bg-rose-950/70 text-rose-200 hover:bg-rose-900/60'
                            : 'border-slate-700 bg-slate-900 text-slate-400 hover:border-slate-600',
                      )}
                    >
                      {b.kembaliGudang === 1 ? '✓ ' : '☐ '}3. Gudang
                    </button>
                    <button
                      type="button"
                      title="Hapus baris dari manifes"
                      onClick={() =>
                        void simpanManifes({
                          ...draf,
                          butir: draf.butir.filter((x) => x.id !== b.id),
                        })
                      }
                      className="rounded px-1.5 py-1 text-xs text-slate-500 hover:bg-slate-800 hover:text-rose-400"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

      {/* Modal Pratinjau Cetak A4 Manifes Logistik (#hex murni) */}
      <Modal
        open={pratinjauOpen}
        onClose={() => setPratinjauOpen(false)}
        title="Pratinjau Manifes Logistik & Loading Truk (A4)"
        testId="modal-pratinjau-manifes"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={() => setPratinjauOpen(false)}>
              Tutup
            </Button>
            <Button
              variant="ghost"
              data-testid="unduh-html-manifes"
              onClick={() => {
                downloadHtmlFile(
                  htmlManifes,
                  `manifes-logistik-${draf.tanggal}-${slugify(namaTim)}.html`,
                )
                toast.push('Manifes HTML A4 diunduh')
              }}
            >
              <IconDownload size={14} /> Unduh HTML
            </Button>
            <Button
              variant="primary"
              data-testid="cetak-manifes-lomba"
              onClick={() => {
                if (!printHtml(htmlManifes)) {
                  toast.push('Jendela cetak diblokir — gunakan tombol Unduh HTML', 'err')
                }
              }}
            >
              <IconPrinter size={14} /> Cetak / PDF
            </Button>
          </>
        }
      >
        <iframe
          data-testid="iframe-pratinjau-manifes"
          title="Pratinjau Cetak Manifes Logistik"
          srcDoc={htmlManifes}
          className="h-[68vh] w-full rounded-lg border border-slate-700 bg-white"
        />
      </Modal>
    </div>
  )
}
