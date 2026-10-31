import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../../db/db'
import type {
  AlatGuard,
  ArahHadapGuard,
  BlokCountSheet,
  CountSheet,
  Drill,
  DrillSet,
  Member,
  SectionDef,
  Song,
} from '../../db/types'
import {
  DAFTAR_ALAT_GUARD,
  DAFTAR_ARAH_HADAP_GUARD,
  LABEL_ALAT_GUARD,
  LABEL_ARAH_HADAP_GUARD,
  LABEL_PENDEK_ALAT_GUARD,
  TEKNIK_CEPAT_GUARD,
  WARNA_ALAT_GUARD_HEX,
  apakahAnggotaGuard,
  bangunHtmlCetakCountSheet,
  buatBlokDariDrill,
  buatBlokDariLagu,
  sisipkanTeknikCepat,
  toggleNomorCount,
  urutkanBlokCountSheet,
  type FormatCetakCountSheet,
} from '../../lib/countSheet'
import { namaTampil } from '../../lib/namaAnggota'
import { downloadHtmlFile, printHtml } from '../../lib/print'
import { cx, slugify, uid } from '../../lib/utils'
import { IconDownload, IconEye, IconPlus, IconPrinter, IconTrash } from '../Icons'
import { Badge, Button, ConfirmButton, Field, Input, Modal, Select, useToast } from '../ui'

export interface PropsModalCountSheet {
  open: boolean
  onClose: () => void
  drill?: Drill | null
  sets?: DrillSet[]
  roster?: Member[]
  songAwal?: Song | null
  namaTim?: string
  sections?: SectionDef[]
}

export default function ModalCountSheet({
  open,
  onClose,
  drill,
  sets = [],
  roster = [],
  songAwal,
  namaTim = 'DrillKit',
  sections = [],
}: PropsModalCountSheet) {
  const toast = useToast()
  const semuaSongs = useLiveQuery(() => db.songs.toArray(), [], [])
  const semuaMembers = useLiveQuery(() => db.members.toArray(), [], [])
  const semuaSheets = useLiveQuery(() => db.countSheets.toArray(), [], [])

  const daftarSheetsKonteks = useMemo(() => {
    const list = semuaSheets ?? []
    if (drill) {
      return list
        .filter((cs) => cs.drillId === drill.id || (!cs.drillId && drill.songId && cs.songId === drill.songId))
        .sort((a, b) => a.createdAt - b.createdAt)
    }
    if (songAwal) {
      return list.filter((cs) => cs.songId === songAwal.id).sort((a, b) => a.createdAt - b.createdAt)
    }
    return list.sort((a, b) => b.updatedAt - a.updatedAt)
  }, [semuaSheets, drill, songAwal])

  const [sheetAktifId, setSheetAktifId] = useState<string>('')
  const [modeKetukPerBlok, setModeKetukPerBlok] = useState<Record<string, 'aksen' | 'tangkap'>>({})
  const [bukaRincianCount, setBukaRincianCount] = useState<Record<string, boolean>>({})
  const [formatCetak, setFormatCetak] = useState<FormatCetakCountSheet>('a4')
  const [cakupanCetak, setCakupanCetak] = useState<string>('semua-guard')
  const [htmlPratinjau, setHtmlPratinjau] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (daftarSheetsKonteks.length > 0 && !daftarSheetsKonteks.some((s) => s.id === sheetAktifId)) {
      setSheetAktifId(daftarSheetsKonteks[0].id)
    } else if (daftarSheetsKonteks.length === 0) {
      setSheetAktifId('')
    }
  }, [open, daftarSheetsKonteks, sheetAktifId])

  const sheetDbAktif = daftarSheetsKonteks.find((s) => s.id === sheetAktifId) ?? null
  const [draftSheet, setDraftSheet] = useState<CountSheet | null>(null)
  const draftRef = useRef<CountSheet | null>(null)

  useEffect(() => {
    if (!sheetDbAktif) {
      draftRef.current = null
      setDraftSheet(null)
      return
    }
    if (
      !draftRef.current ||
      draftRef.current.id !== sheetDbAktif.id ||
      sheetDbAktif.updatedAt > draftRef.current.updatedAt
    ) {
      draftRef.current = sheetDbAktif
      setDraftSheet(sheetDbAktif)
    }
  }, [sheetDbAktif])

  const sheetAktif = draftSheet ?? sheetDbAktif
  const urutSets = useMemo(() => [...sets].sort((a, b) => a.order - b.order), [sets])

  const laguTerkait = useMemo(() => {
    const targetSongId = sheetAktif?.songId ?? drill?.songId ?? songAwal?.id
    if (!targetSongId) return null
    return (semuaSongs ?? []).find((s) => s.id === targetSongId) ?? songAwal ?? null
  }, [semuaSongs, sheetAktif?.songId, drill?.songId, songAwal])

  const daftarAnggotaSumber = roster.length > 0 ? roster : (semuaMembers ?? []).filter((m) => m.active)
  const anggotaGuard = useMemo(() => {
    const khusus = daftarAnggotaSumber.filter((m) =>
      sheetAktif ? m.section === sheetAktif.seksi || apakahAnggotaGuard(m, sections, [sheetAktif]) : apakahAnggotaGuard(m, sections),
    )
    return khusus.length > 0 ? khusus : daftarAnggotaSumber
  }, [daftarAnggotaSumber, sheetAktif, sections])

  async function buatCountSheetBaru() {
    const skrg = Date.now()
    const seksiDefault =
      sections.find((s) => s.id === 'guard' || s.label.toLowerCase().includes('guard'))?.id ?? 'guard'
    const dasarJudul = drill
      ? `${drill.name} — Flag Utama`
      : songAwal
        ? `${songAwal.title} — Count Sheet Guard`
        : `Count Sheet Guard ${(semuaSheets?.length ?? 0) + 1}`
    const blokAwal = drill && urutSets.length > 0
      ? buatBlokDariDrill({
          drill,
          sets: urutSets,
          song: laguTerkait,
          mode: 'per-8',
          alatUtama: 'flag',
        })
      : laguTerkait
        ? buatBlokDariLagu(laguTerkait, 'flag', 2)
        : [
            {
              id: uid('bcs_'),
              urutan: 0,
              labelBagian: 'Bagian 1 (1–8)',
              counts: 8,
              biramaDari: 1,
              biramaSampai: 2,
              alat: 'flag' as AlatGuard,
              teknik: '',
              arahHadap: 'depan' as ArahHadapGuard,
            },
          ]

    const baru: CountSheet = {
      id: uid('cs_'),
      judul: dasarJudul,
      drillId: drill?.id,
      songId: drill?.songId ?? songAwal?.id,
      seksi: seksiDefault,
      alatUtama: 'flag',
      blok: blokAwal,
      createdAt: skrg,
      updatedAt: skrg,
    }
    draftRef.current = baru
    setDraftSheet(baru)
    await db.countSheets.put(baru)
    setSheetAktifId(baru.id)
    toast.push('Lembar Count Sheet baru siap disunting')
  }

  async function simpanPatchSheet(patch: Partial<CountSheet>) {
    const sumber = draftRef.current ?? sheetAktif
    if (!sumber) return
    const terbaru: CountSheet = {
      ...sumber,
      ...patch,
      updatedAt: Math.max(Date.now(), (sumber.updatedAt || 0) + 1),
    }
    draftRef.current = terbaru
    setDraftSheet(terbaru)
    await db.countSheets.put(terbaru)
  }

  async function simpanBlok(blokBaru: BlokCountSheet[]) {
    const sumber = draftRef.current ?? sheetAktif
    if (!sumber) return
    await simpanPatchSheet({ blok: urutkanBlokCountSheet(blokBaru) })
  }

  async function ubahSatuBlok(blokId: string, patch: Partial<BlokCountSheet>) {
    const sumber = draftRef.current ?? sheetAktif
    if (!sumber) return
    const daftar = urutkanBlokCountSheet(sumber.blok).map((b) =>
      b.id === blokId ? { ...b, ...patch } : b,
    )
    await simpanBlok(daftar)
  }

  async function tambahBlokManual() {
    const sumber = draftRef.current ?? sheetAktif
    if (!sumber) return
    const daftar = urutkanBlokCountSheet(sumber.blok)
    const terakhir = daftar[daftar.length - 1]
    const barAwal = terakhir?.biramaSampai ? terakhir.biramaSampai + 1 : undefined
    const baru: BlokCountSheet = {
      id: uid('bcs_'),
      urutan: daftar.length,
      labelBagian: `Bagian ${daftar.length + 1}`,
      counts: 8,
      biramaDari: barAwal,
      biramaSampai: barAwal ? barAwal + 1 : undefined,
      alat: terakhir?.alat ?? sumber.alatUtama,
      teknik: '',
      arahHadap: 'depan',
    }
    await simpanBlok([...daftar, baru])
  }

  async function geserBlok(idx: number, arah: -1 | 1) {
    const sumber = draftRef.current ?? sheetAktif
    if (!sumber) return
    const daftar = urutkanBlokCountSheet(sumber.blok)
    const tujuan = idx + arah
    if (tujuan < 0 || tujuan >= daftar.length) return
    const salin = [...daftar]
    const tmp = salin[idx]
    salin[idx] = salin[tujuan]
    salin[tujuan] = tmp
    await simpanBlok(salin.map((b, i) => ({ ...b, urutan: i })))
  }

  async function hapusBlok(blokId: string) {
    const sumber = draftRef.current ?? sheetAktif
    if (!sumber) return
    const sisa = urutkanBlokCountSheet(sumber.blok).filter((b) => b.id !== blokId)
    await simpanBlok(sisa)
  }

  async function susunUlangDariSet(mode: 'per-8' | 'per-set') {
    const sumber = draftRef.current ?? sheetAktif
    if (!sumber || !drill) return
    const targetSongId = sumber.songId ?? drill.songId ?? songAwal?.id
    const laguSekarang = targetSongId
      ? (semuaSongs ?? []).find((s) => s.id === targetSongId) ?? songAwal ?? null
      : null
    const hasil = buatBlokDariDrill({
      drill,
      sets: urutSets,
      song: laguSekarang,
      mode,
      alatUtama: sumber.alatUtama,
      blokSebelumnya: sumber.blok,
    })
    await simpanBlok(hasil)
    toast.push(
      mode === 'per-8'
        ? `${hasil.length} blok 8-count disinkronkan dari Set & Birama`
        : `${hasil.length} blok per Set disinkronkan`,
    )
  }

  async function hapusSheetAktif() {
    const sumber = draftRef.current ?? sheetAktif
    if (!sumber) return
    draftRef.current = null
    setDraftSheet(null)
    await db.countSheets.delete(sumber.id)
    setSheetAktifId('')
    toast.push('Count Sheet dihapus', 'info')
  }

  function susunHtmlCetakSekarang(): string {
    const sumber = draftRef.current ?? sheetAktif
    if (!sumber) return ''
    let targetPemain: Member[] | undefined
    if (cakupanCetak === 'umum') {
      targetPemain = undefined
    } else if (cakupanCetak === 'semua-guard') {
      const saring = sumber.memberIds?.length
        ? anggotaGuard.filter((m) => sumber.memberIds!.includes(m.id))
        : anggotaGuard.filter((m) => m.section === sumber.seksi)
      targetPemain = saring.length > 0 ? saring : undefined
    } else {
      const satu = daftarAnggotaSumber.find((m) => m.id === cakupanCetak)
      targetPemain = satu ? [satu] : undefined
    }
    return bangunHtmlCetakCountSheet({
      sheet: sumber,
      format: formatCetak,
      namaTim,
      drill,
      sets: urutSets,
      song: laguTerkait,
      daftarAnggota: targetPemain,
      sections,
    })
  }

  function jalankanCetak() {
    const html = susunHtmlCetakSekarang()
    if (!html || !sheetAktif) return
    if (!printHtml(html)) {
      downloadHtmlFile(html, `${slugify(sheetAktif.judul)}-${formatCetak}.html`)
      toast.push('Jendela cetak diblokir — berkas HTML diunduh. Buka lalu Ctrl+P.', 'info')
    }
  }

  function jalankanUnduhHtml() {
    const html = susunHtmlCetakSekarang()
    if (!html || !sheetAktif) return
    downloadHtmlFile(html, `${slugify(sheetAktif.judul)}-${formatCetak}.html`)
    toast.push('Berkas HTML siap cetak diunduh')
  }

  const daftarBlok = useMemo(
    () => (sheetAktif ? urutkanBlokCountSheet(sheetAktif.blok) : []),
    [sheetAktif],
  )

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Lembar Hitungan Color Guard (Count Sheet)"
        testId="modal-count-sheet"
        wide
        footer={
          <div className="flex w-full flex-wrap items-center justify-between gap-2">
            {sheetAktif ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <Select
                  data-testid="pilih-format-cetak-cs"
                  value={formatCetak}
                  onChange={(e) => setFormatCetak(e.target.value as FormatCetakCountSheet)}
                  className="text-xs"
                >
                  <option value="a4">Cetak A4 Gabungan</option>
                  <option value="buku-saku">Buku Saku Lipat Guard (A5)</option>
                </Select>
                <Select
                  data-testid="pilih-cakupan-cetak-cs"
                  value={cakupanCetak}
                  onChange={(e) => setCakupanCetak(e.target.value)}
                  className="text-xs"
                >
                  <option value="semua-guard">Per Anggota Guard (+ Koordinat)</option>
                  <option value="umum">Lembar Umum Seksi (1 Halaman)</option>
                  {anggotaGuard.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.code} — {namaTampil(m)}
                    </option>
                  ))}
                </Select>
                <Button
                  size="sm"
                  variant="ghost"
                  data-testid="pratinjau-cetak-cs"
                  onClick={() => setHtmlPratinjau(susunHtmlCetakSekarang())}
                >
                  <IconEye size={14} /> Pratinjau
                </Button>
                <Button size="sm" variant="ghost" data-testid="unduh-html-cs" onClick={jalankanUnduhHtml}>
                  <IconDownload size={14} /> Unduh HTML
                </Button>
                <Button size="sm" variant="primary" data-testid="cetak-cs" onClick={jalankanCetak}>
                  <IconPrinter size={14} /> Cetak / PDF
                </Button>
              </div>
            ) : (
              <span />
            )}
            <Button variant="ghost" onClick={onClose}>
              Tutup
            </Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Bilah Pilih / Buat Lembar Count Sheet */}
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-950/60 p-2.5">
            {daftarSheetsKonteks.length > 0 ? (
              <Select
                data-testid="pilih-count-sheet"
                value={sheetAktif?.id ?? ''}
                onChange={(e) => setSheetAktifId(e.target.value)}
                className="min-w-[200px] flex-1"
              >
                {daftarSheetsKonteks.map((cs) => (
                  <option key={cs.id} value={cs.id}>
                    {cs.judul} ({LABEL_PENDEK_ALAT_GUARD[cs.alatUtama]} · {cs.blok.length} blok)
                  </option>
                ))}
              </Select>
            ) : (
              <p className="flex-1 text-xs text-slate-400">
                Belum ada lembar hitungan Color Guard untuk show/lagu ini.
              </p>
            )}
            <Button
              size="sm"
              variant="primary"
              data-testid="buat-count-sheet-baru"
              onClick={buatCountSheetBaru}
            >
              <IconPlus size={14} /> Buat Count Sheet
            </Button>
            {sheetAktif && (
              <ConfirmButton
                size="sm"
                label="Hapus Lembar"
                message="Yakin hapus lembar Count Sheet ini?"
                onConfirm={hapusSheetAktif}
              />
            )}
          </div>

          {sheetAktif && (
            <>
              {/* Metadata Lembar */}
              <div className="grid gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3 sm:grid-cols-3">
                <Field label="Judul Lembar">
                  <Input
                    data-testid="input-judul-cs"
                    value={sheetAktif.judul}
                    onChange={(e) => simpanPatchSheet({ judul: e.target.value })}
                    placeholder="Mis. Opening Show — Flag Utama"
                  />
                </Field>
                <Field label="Alat Utama">
                  <Select
                    data-testid="pilih-alat-utama-cs"
                    value={sheetAktif.alatUtama}
                    onChange={(e) => simpanPatchSheet({ alatUtama: e.target.value as AlatGuard })}
                  >
                    {DAFTAR_ALAT_GUARD.map((al) => (
                      <option key={al} value={al}>
                        {LABEL_ALAT_GUARD[al]}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Seksi Tujuan">
                  <Select
                    data-testid="pilih-seksi-cs"
                    value={sheetAktif.seksi}
                    onChange={(e) => simpanPatchSheet({ seksi: e.target.value })}
                  >
                    {(sections.length > 0
                      ? sections
                      : [{ id: 'guard', label: 'Color Guard', short: 'CG', dot: '#ec4899' }]
                    ).map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </Select>
                </Field>
                <Field label="Lagu Terkait (Sinkronisasi Birama)">
                  <Select
                    data-testid="pilih-lagu-cs"
                    value={sheetAktif.songId ?? ''}
                    onChange={(e) => simpanPatchSheet({ songId: e.target.value || undefined })}
                  >
                    <option value="">— Tanpa tautan lagu —</option>
                    {(semuaSongs ?? []).map((sg) => (
                      <option key={sg.id} value={sg.id}>
                        {sg.title} ({sg.bpm} BPM)
                      </option>
                    ))}
                  </Select>
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Catatan Persiapan Alat / Staging (opsional)">
                    <Input
                      data-testid="input-catatan-umum-cs"
                      value={sheetAktif.catatanUmum ?? ''}
                      onChange={(e) => simpanPatchSheet({ catatanUmum: e.target.value })}
                      placeholder="Mis. Rifle parkir di Hash Depan S1 sebelum Set 4"
                    />
                  </Field>
                </div>

                {/* Filter Sub-Kelompok Anggota (opsional, mis. Rifle Line vs Flag Line) */}
                {anggotaGuard.length > 0 && (
                  <div className="sm:col-span-3">
                    <p className="mb-1 text-[11px] font-medium text-slate-400">
                      Berlaku untuk anggota:{' '}
                      <span className="text-slate-500">
                        {sheetAktif.memberIds?.length
                          ? `${sheetAktif.memberIds.length} pemain terpilih (sub-kelompok)`
                          : `Seluruh seksi (${anggotaGuard.length} pemain)`}
                      </span>
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {anggotaGuard.map((m) => {
                        const dipilih = (sheetAktif.memberIds ?? []).includes(m.id)
                        return (
                          <button
                            key={m.id}
                            type="button"
                            data-testid={`pil-anggota-cs-${m.code}`}
                            onClick={() => {
                              const skrg = new Set(sheetAktif.memberIds ?? [])
                              if (skrg.has(m.id)) skrg.delete(m.id)
                              else skrg.add(m.id)
                              const arr = Array.from(skrg)
                              void simpanPatchSheet({ memberIds: arr.length ? arr : undefined })
                            }}
                            className={cx(
                              'rounded-full border px-2 py-0.5 text-[11px] transition',
                              dipilih
                                ? 'border-pink-500/60 bg-pink-500/20 font-semibold text-pink-200'
                                : 'border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700',
                            )}
                          >
                            {m.code} · {namaTampil(m)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Bilah Generator Blok Cepat */}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  {drill && urutSets.length > 0 && (
                    <>
                      <Button
                        size="sm"
                        variant="ghost"
                        data-testid="susun-blok-per8"
                        onClick={() => susunUlangDariSet('per-8')}
                      >
                        Sinkronkan per 8-Count dari Set
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        data-testid="susun-blok-perset"
                        onClick={() => susunUlangDariSet('per-set')}
                      >
                        1 Blok per Set
                      </Button>
                    </>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    data-testid="tambah-blok-count"
                    onClick={tambahBlokManual}
                  >
                    <IconPlus size={14} /> Tambah Blok
                  </Button>
                </div>
                <span className="text-[11px] text-slate-500">
                  Total {daftarBlok.length} blok ·{' '}
                  {daftarBlok.reduce((t, b) => t + (b.counts || 0), 0)} hitungan
                </span>
              </div>

              {/* Daftar Blok Koreografi */}
              <div className="space-y-3">
                {daftarBlok.map((bl, idx) => {
                  const modeKetuk = modeKetukPerBlok[bl.id] ?? 'aksen'
                  const palet = WARNA_ALAT_GUARD_HEX[bl.alat] ?? WARNA_ALAT_GUARD_HEX.flag
                  const maksPil = Math.min(24, Math.max(1, bl.counts))
                  const rincianTerbuka = !!bukaRincianCount[bl.id]

                  return (
                    <div
                      key={bl.id}
                      data-testid={`blok-count-sheet-${idx}`}
                      className="rounded-lg border border-slate-800 bg-slate-950/60 p-3"
                    >
                      {/* Baris Kepala Blok */}
                      <div className="mb-2.5 flex flex-wrap items-center gap-2">
                        <Badge className="bg-slate-800 text-slate-200">#{idx + 1}</Badge>
                        <Input
                          data-testid={`input-label-blok-${idx}`}
                          value={bl.labelBagian}
                          onChange={(e) => ubahSatuBlok(bl.id, { labelBagian: e.target.value })}
                          className="min-w-[140px] flex-1 text-xs font-semibold"
                          placeholder="Label bagian (mis. Set 1 (1–8))"
                        />
                        <Select
                          data-testid={`pilih-alat-blok-${idx}`}
                          value={bl.alat}
                          onChange={(e) => ubahSatuBlok(bl.id, { alat: e.target.value as AlatGuard })}
                          className="text-xs"
                          style={{ borderColor: palet.titikGelap }}
                        >
                          {DAFTAR_ALAT_GUARD.map((al) => (
                            <option key={al} value={al}>
                              {LABEL_PENDEK_ALAT_GUARD[al]}
                            </option>
                          ))}
                        </Select>
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <Input
                            type="number"
                            min={1}
                            max={64}
                            data-testid={`input-counts-blok-${idx}`}
                            value={bl.counts}
                            onChange={(e) =>
                              ubahSatuBlok(bl.id, { counts: Math.max(1, Number(e.target.value) || 8) })
                            }
                            className="w-16 text-center text-xs"
                          />
                          <span>cnt</span>
                        </div>
                        <div className="ml-auto flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => geserBlok(idx, -1)}
                            disabled={idx === 0}
                            className="rounded border border-slate-800 px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-30"
                            title="Naikkan urutan"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => geserBlok(idx, 1)}
                            disabled={idx === daftarBlok.length - 1}
                            className="rounded border border-slate-800 px-1.5 py-0.5 text-xs text-slate-400 hover:bg-slate-800 disabled:opacity-30"
                            title="Turunkan urutan"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            data-testid={`hapus-blok-${idx}`}
                            onClick={() => hapusBlok(bl.id)}
                            className="rounded border border-slate-800 p-1 text-slate-500 hover:border-rose-800 hover:text-rose-400"
                            title="Hapus blok ini"
                          >
                            <IconTrash size={13} />
                          </button>
                        </div>
                      </div>

                      {/* Tautan Set & Rentang Birama */}
                      <div className="mb-2.5 grid gap-2 sm:grid-cols-4">
                        {urutSets.length > 0 && (
                          <Select
                            data-testid={`pilih-set-blok-${idx}`}
                            value={bl.setId ?? ''}
                            onChange={(e) =>
                              ubahSatuBlok(bl.id, { setId: e.target.value || undefined })
                            }
                            className="text-xs"
                          >
                            <option value="">— Tanpa tautan Set —</option>
                            {urutSets.map((st, sIdx) => (
                              <option key={st.id} value={st.id}>
                                {st.name || `Set ${sIdx + 1}`} ({st.counts} cnt)
                              </option>
                            ))}
                          </Select>
                        )}
                        <div className="flex items-center gap-1 text-xs text-slate-400">
                          <span className="shrink-0">Bar:</span>
                          <Input
                            type="number"
                            min={1}
                            data-testid={`input-bar-dari-${idx}`}
                            value={bl.biramaDari ?? ''}
                            placeholder="Dari"
                            onChange={(e) =>
                              ubahSatuBlok(bl.id, {
                                biramaDari: e.target.value ? Math.max(1, Number(e.target.value)) : undefined,
                              })
                            }
                            className="w-16 text-xs"
                          />
                          <span>–</span>
                          <Input
                            type="number"
                            min={1}
                            data-testid={`input-bar-sampai-${idx}`}
                            value={bl.biramaSampai ?? ''}
                            placeholder="Sampai"
                            onChange={(e) =>
                              ubahSatuBlok(bl.id, {
                                biramaSampai: e.target.value ? Math.max(1, Number(e.target.value)) : undefined,
                              })
                            }
                            className="w-16 text-xs"
                          />
                        </div>
                        <Select
                          data-testid={`pilih-hadap-blok-${idx}`}
                          value={bl.arahHadap ?? 'depan'}
                          onChange={(e) =>
                            ubahSatuBlok(bl.id, { arahHadap: e.target.value as ArahHadapGuard })
                          }
                          className="text-xs"
                        >
                          {DAFTAR_ARAH_HADAP_GUARD.map((ah) => (
                            <option key={ah} value={ah}>
                              {LABEL_ARAH_HADAP_GUARD[ah]}
                            </option>
                          ))}
                        </Select>
                        <Input
                          data-testid={`input-tangan-blok-${idx}`}
                          value={bl.posisiTangan ?? ''}
                          onChange={(e) => ubahSatuBlok(bl.id, { posisiTangan: e.target.value })}
                          placeholder="Posisi tangan (mis. Kanan di tab, flat)"
                          className="text-xs"
                        />
                      </div>

                      {/* Ringkasan Teknik + Pil Cepat */}
                      <div className="mb-2">
                        <Input
                          data-testid={`input-teknik-blok-${idx}`}
                          value={bl.teknik}
                          onChange={(e) => ubahSatuBlok(bl.id, { teknik: e.target.value })}
                          placeholder="Teknik kerja alat (mis. Drop Spin 1–6, Prep 7, Toss 45 di 8)"
                          className="text-xs"
                        />
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {(TEKNIK_CEPAT_GUARD[bl.alat] ?? []).map((tek) => (
                            <button
                              key={tek}
                              type="button"
                              data-testid={`pil-teknik-${idx}-${tek}`}
                              onClick={() =>
                                ubahSatuBlok(bl.id, {
                                  teknik: sisipkanTeknikCepat(bl.teknik, tek),
                                })
                              }
                              className="rounded border border-slate-800 bg-slate-900 px-2 py-0.5 text-[10px] text-slate-300 hover:border-emerald-600/50 hover:text-emerald-200"
                            >
                              + {tek}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Pita Ketuk Hitungan 1..N (Aksen ▲ & Catch ★) */}
                      <div className="rounded-md border border-slate-800/80 bg-slate-900/50 p-2">
                        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-1 text-[11px]">
                            <span className="text-slate-400">Ketuk angka untuk menandai:</span>
                            <button
                              type="button"
                              data-testid={`mode-ketuk-aksen-${idx}`}
                              onClick={() =>
                                setModeKetukPerBlok((p) => ({ ...p, [bl.id]: 'aksen' }))
                              }
                              className={cx(
                                'rounded px-2 py-0.5 font-semibold transition',
                                modeKetuk === 'aksen'
                                  ? 'bg-amber-500/25 text-amber-200 ring-1 ring-amber-500/50'
                                  : 'text-slate-400 hover:text-slate-200',
                              )}
                            >
                              ▲ Aksen / Release
                            </button>
                            <button
                              type="button"
                              data-testid={`mode-ketuk-tangkap-${idx}`}
                              onClick={() =>
                                setModeKetukPerBlok((p) => ({ ...p, [bl.id]: 'tangkap' }))
                              }
                              className={cx(
                                'rounded px-2 py-0.5 font-semibold transition',
                                modeKetuk === 'tangkap'
                                  ? 'bg-emerald-500/25 text-emerald-200 ring-1 ring-emerald-500/50'
                                  : 'text-slate-400 hover:text-slate-200',
                              )}
                            >
                              ★ Catch
                            </button>
                          </div>
                          <button
                            type="button"
                            data-testid={`toggle-rincian-count-${idx}`}
                            onClick={() =>
                              setBukaRincianCount((p) => ({ ...p, [bl.id]: !p[bl.id] }))
                            }
                            className="text-[11px] text-sky-400 hover:underline"
                          >
                            {rincianTerbuka ? 'Sembunyikan rincian per hitungan' : 'Isi rincian per hitungan'}
                          </button>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {Array.from({ length: maksPil }, (_, i) => i + 1).map((c) => {
                            const ak = (bl.aksenCount ?? []).includes(c)
                            const tk = (bl.tangkapCount ?? []).includes(c)
                            return (
                              <button
                                key={c}
                                type="button"
                                data-testid={`pil-count-${idx}-${c}`}
                                onClick={() => {
                                  if (modeKetuk === 'aksen') {
                                    void ubahSatuBlok(bl.id, {
                                      aksenCount: toggleNomorCount(bl.aksenCount, c, bl.counts),
                                    })
                                  } else {
                                    void ubahSatuBlok(bl.id, {
                                      tangkapCount: toggleNomorCount(bl.tangkapCount, c, bl.counts),
                                    })
                                  }
                                }}
                                className={cx(
                                  'min-w-[28px] rounded border px-1.5 py-0.5 text-[11px] font-bold tabular-nums transition',
                                  tk
                                    ? 'border-emerald-500 bg-emerald-500/25 text-emerald-200'
                                    : ak
                                      ? 'border-amber-500 bg-amber-500/25 text-amber-200'
                                      : 'border-slate-700 bg-slate-950 text-slate-400 hover:border-slate-500',
                                )}
                              >
                                {c}
                                {tk ? '★' : ak ? '▲' : ''}
                              </button>
                            )
                          })}
                        </div>

                        {rincianTerbuka && (
                          <div className="mt-2 grid gap-1.5 sm:grid-cols-4">
                            {Array.from({ length: Math.min(16, bl.counts) }, (_, i) => i + 1).map(
                              (c) => (
                                <div key={c} className="flex items-center gap-1">
                                  <span className="w-5 text-right font-mono text-[10px] text-slate-400">
                                    {c}:
                                  </span>
                                  <Input
                                    data-testid={`input-detail-count-${idx}-${c}`}
                                    value={bl.detailPerCount?.[c] ?? ''}
                                    onChange={(e) => {
                                      const v = e.target.value
                                      const salin = { ...(bl.detailPerCount ?? {}) }
                                      if (v.trim()) salin[c] = v
                                      else delete salin[c]
                                      void ubahSatuBlok(bl.id, {
                                        detailPerCount: Object.keys(salin).length ? salin : undefined,
                                      })
                                    }}
                                    placeholder={`Count ${c}`}
                                    className="py-1 text-[11px]"
                                  />
                                </div>
                              ),
                            )}
                          </div>
                        )}
                      </div>

                      {/* Catatan Ekspresi/Staging */}
                      <div className="mt-2">
                        <Input
                          data-testid={`input-catatan-blok-${idx}`}
                          value={bl.catatan ?? ''}
                          onChange={(e) => ubahSatuBlok(bl.id, { catatan: e.target.value })}
                          placeholder="Catatan ekspresi / kualitas gerak (opsional)"
                          className="text-xs"
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </Modal>

      {/* Modal Pratinjau Hasil Cetak (Hex Murni) */}
      <Modal
        open={htmlPratinjau != null}
        onClose={() => setHtmlPratinjau(null)}
        title="Pratinjau Cetak Count Sheet Guard"
        testId="modal-pratinjau-cs"
        wide
        footer={
          <>
            <Button variant="ghost" onClick={jalankanUnduhHtml}>
              <IconDownload size={14} /> Unduh HTML
            </Button>
            <Button variant="primary" onClick={jalankanCetak}>
              <IconPrinter size={14} /> Cetak / PDF
            </Button>
            <Button variant="ghost" onClick={() => setHtmlPratinjau(null)}>
              Tutup
            </Button>
          </>
        }
      >
        {htmlPratinjau && (
          <iframe
            data-testid="iframe-pratinjau-cs"
            title="Pratinjau Cetak Count Sheet"
            srcDoc={htmlPratinjau}
            className="h-[68vh] w-full rounded-lg border border-slate-700 bg-white"
          />
        )}
      </Modal>
    </>
  )
}
